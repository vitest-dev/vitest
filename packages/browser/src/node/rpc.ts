import type { MockerRegistry } from '@vitest/mocker'
import type { Duplex } from 'node:stream'
import type { TestError } from 'vitest'
import type { BrowserCommandContext, ResolveSnapshotPathHandlerContext, TestProject } from 'vitest/node'
import type { WebSocket } from 'ws'
import type { WebSocketBrowserEvents, WebSocketBrowserHandlers } from '../types'
import type { ParentBrowserProject } from './projectParent'
import type { BrowserServerState } from './state'
import { existsSync, promises as fs } from 'node:fs'
import { AutomockedModule, AutospiedModule, ManualMockedModule, RedirectedModule } from '@vitest/mocker'
import { ServerMockResolver } from '@vitest/mocker/node'
import { extractSourcemapFromFile } from '@vitest/utils/source-map/node'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { dirname, join } from 'pathe'
import { createDebugger, isFileLoadingAllowed, isValidApiRequest } from 'vitest/node'
import { WebSocketServer } from 'ws'

const debug = createDebugger('vitest:browser:api')

const BROWSER_API_PATH = '/__vitest_browser_api__'

export function setupBrowserRpc(globalServer: ParentBrowserProject, defaultMockerRegistry: MockerRegistry): void {
  const vite = globalServer.vite
  const vitest = globalServer.vitest

  const wss = new WebSocketServer({ noServer: true })

  vite.httpServer?.on('upgrade', (request, socket: Duplex, head: Buffer) => {
    if (!request.url) {
      return
    }

    const { pathname, searchParams } = new URL(request.url, 'http://localhost')
    if (pathname !== BROWSER_API_PATH) {
      return
    }

    if (!isValidApiRequest(vitest.config, request)) {
      socket.destroy()
      return
    }

    const type = searchParams.get('type')
    const rpcId = searchParams.get('rpcId')
    const sessionId = searchParams.get('sessionId')
    const projectName = searchParams.get('projectName')

    if (type !== 'tester' && type !== 'orchestrator') {
      return error(
        new Error(`[vitest] Type query in ${request.url} is invalid. Type should be either "tester" or "orchestrator".`),
      )
    }

    if (!sessionId || !rpcId || projectName == null) {
      return error(
        new Error(`[vitest] Invalid URL ${request.url}. "projectName", "sessionId" and "rpcId" queries are required.`),
      )
    }

    const sessions = vitest._browserSessions

    if (!sessions.sessionIds.has(sessionId)) {
      const ids = [...sessions.sessionIds].join(', ')
      return error(
        new Error(`[vitest] Unknown session id "${sessionId}". Expected one of ${ids}.`),
      )
    }

    if (type === 'orchestrator') {
      const session = sessions.getSession(sessionId)
      // it's possible the session was already resolved by the preview provider
      session?.connected()
    }

    const project = vitest.getProjectByName(projectName)

    if (!project) {
      return error(
        new Error(`[vitest] Project "${projectName}" not found.`),
      )
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)

      const { rpc, offCancel } = setupClient(project, rpcId, ws)
      const state = project.browser!.state as BrowserServerState
      const clients = type === 'tester' ? state.testers : state.orchestrators
      clients.set(rpcId, rpc)

      debug?.('[%s] Browser API connected to %s', rpcId, type)

      ws.on('close', () => {
        debug?.('[%s] Browser API disconnected from %s', rpcId, type)
        offCancel()
        clients.delete(rpcId)
        globalServer.removeCDPHandler(rpcId)
        if (type === 'orchestrator') {
          sessions.destroySession(sessionId)
        }
        // this will reject any hanging methods if there are any
        rpc.$close(
          new Error(`[vitest] Browser connection was closed while running tests. Was the page closed unexpectedly?`),
        )
      })
    })
  })

  // we don't throw an error inside a stream because this can segfault the process
  function error(err: Error) {
    console.error(err)
    vitest.state.catchError(err, 'RPC Error')
  }

  function checkFileAccess(path: string) {
    if (!isFileLoadingAllowed(vite.config, path)) {
      throw new Error(
        `Access denied to "${path}". See Vite config documentation for "server.fs": https://vitejs.dev/config/server-options.html#server-fs-strict.`,
      )
    }
  }

  function canWrite(project: TestProject) {
    return (
      project.config.browser.api.allowWrite
      && project.vitest.config.browser.api.allowWrite
      && project.config.api.allowWrite
      && project.vitest.config.api.allowWrite
    )
  }

  function setupClient(project: TestProject, rpcId: string, ws: WebSocket) {
    const mockResolver = new ServerMockResolver(globalServer.vite, {
      moduleDirectories: project.config?.deps?.moduleDirectories,
    })
    const mocker = project.browser?.provider.mocker

    const rpc = createBirpc<WebSocketBrowserEvents, WebSocketBrowserHandlers>(
      {
        async onUnhandledError(error, type) {
          if (error && typeof error === 'object') {
            const _error = error as TestError
            _error.stacks = globalServer.parseErrorStacktrace(_error)
          }
          vitest.state.catchError(error, type)
        },
        async onQueued(method, file) {
          if (method === 'collect') {
            vitest.state.collectFiles(project, [file])
          }
          else {
            await vitest._testRun.enqueued(project, file)
          }
        },
        async onCollected(method, files) {
          if (method === 'collect') {
            vitest.state.collectFiles(project, files)
          }
          else {
            await vitest._testRun.collected(project, files)
          }
        },
        async onTaskArtifactRecord(id, artifact) {
          if (!canWrite(project)) {
            if (artifact.type === 'internal:annotation' && artifact.annotation.attachment) {
              artifact.annotation.attachment = undefined
              vitest.logger.error(
                `[vitest] Cannot record annotation attachment because file writing is disabled. See https://vitest.dev/config/browser/api.`,
              )
            }
            // remove attachments if cannot write
            if (artifact.attachments?.length) {
              const attachments = artifact.attachments.map(n => n.path).filter(r => !!r).join('", "')
              artifact.attachments = []
              vitest.logger.error(
                `[vitest] Cannot record attachments ("${attachments}") because file writing is disabled, removing attachments from artifact "${artifact.type}". See https://vitest.dev/config/browser/api.`,
              )
            }
          }

          return vitest._testRun.recordArtifact(id, artifact)
        },
        async onTaskUpdate(method, packs, events) {
          if (method === 'collect') {
            vitest.state.updateTasks(packs)
          }
          else {
            await vitest._testRun.updated(packs, events)
          }
        },
        onAfterSuiteRun(meta) {
          vitest.coverageProvider?.onAfterSuiteRun(meta)
        },
        async sendLog(method, log) {
          if (method === 'collect') {
            vitest.state.updateUserLog(log)
          }
          else {
            await vitest._testRun.log(log)
          }
        },
        resolveSnapshotPath(testPath) {
          return vitest.snapshot.resolvePath<ResolveSnapshotPathHandlerContext>(testPath, {
            config: project.serializedConfig,
          })
        },
        resolveSnapshotRawPath(testPath, rawPath) {
          return vitest.snapshot.resolveRawPath(testPath, rawPath)
        },
        snapshotSaved(snapshot) {
          vitest.snapshot.add(snapshot)
        },
        async readSnapshotFile(snapshotPath) {
          checkFileAccess(snapshotPath)
          if (!existsSync(snapshotPath)) {
            return null
          }
          return fs.readFile(snapshotPath, 'utf-8')
        },
        async saveSnapshotFile(id, content) {
          checkFileAccess(id)
          if (!canWrite(project)) {
            vitest.logger.error(
              `[vitest] Cannot save snapshot file "${id}". File writing is disabled because server is exposed to the internet, see https://vitest.dev/config/browser/api.`,
            )
            return
          }
          await fs.mkdir(dirname(id), { recursive: true })
          await fs.writeFile(id, content, 'utf-8')
        },
        async removeSnapshotFile(id) {
          checkFileAccess(id)
          if (!canWrite(project)) {
            vitest.logger.error(
              `[vitest] Cannot remove snapshot file "${id}". File writing is disabled because server is exposed to the internet, see https://vitest.dev/config/browser/api.`,
            )
            return
          }
          if (!existsSync(id)) {
            throw new Error(`Snapshot file "${id}" does not exist.`)
          }
          await fs.unlink(id)
        },
        getBrowserFileSourceMap(id) {
          const mod = globalServer.vite.moduleGraph.getModuleById(id)
          const result = mod?.transformResult
          // handle non-inline source map such as pre-bundled deps in node_modules/.vite
          if (result && !result.map) {
            const filePath = id.split('?')[0]
            const extracted = extractSourcemapFromFile(result.code, filePath)
            return extracted?.map
          }
          return result?.map
        },
        cancelCurrentRun(reason) {
          vitest.cancelCurrentRun(reason)
        },
        async resolveId(id, importer) {
          return mockResolver.resolveId(id, importer)
        },
        debug(...args) {
          vitest.logger.console.debug(...args)
        },
        getCountOfFailedTests() {
          return vitest.state.getCountOfFailedTests()
        },
        async wdioSwitchContext(direction) {
          const provider = project.browser!.provider
          if (!provider) {
            throw new Error('Commands are only available for browser tests.')
          }
          if (provider.name !== 'webdriverio') {
            throw new Error('Switch context is only available for WebDriverIO provider.')
          }
          if (direction === 'iframe') {
            await (provider as any).switchToTestFrame()
          }
          else {
            await (provider as any).switchToMainFrame()
          }
        },
        async triggerCommand(sessionId, command, testPath, payload) {
          debug?.('[%s] Triggering command "%s"', sessionId, command)
          const provider = project.browser!.provider
          if (!provider) {
            throw new Error('Commands are only available for browser tests.')
          }
          const context = Object.assign(
            {
              testPath,
              project,
              provider,
              contextId: sessionId,
              sessionId,
              triggerCommand: (name: string, ...args: any[]) => {
                return project.browser!.triggerCommand(
                  name as any,
                  context,
                  ...args,
                )
              },
            },
            provider.getCommandsContext(sessionId),
          ) as any as BrowserCommandContext
          return await project.browser!.triggerCommand(
            command as any,
            context,
            ...payload,
          )
        },
        resolveMock(rawId, importer, options) {
          return mockResolver.resolveMock(rawId, importer, options)
        },
        invalidate(ids) {
          return mockResolver.invalidate(ids)
        },

        async registerMock(sessionId, module) {
          if (!mocker) {
            // make sure modules are not processed yet in case they were imported before
            // and were not mocked
            mockResolver.invalidate([module.id])

            if (module.type === 'manual') {
              const mock = ManualMockedModule.fromJSON(module, async () => {
                try {
                  const { keys } = await rpc.resolveManualMock(module.url)
                  return Object.fromEntries(keys.map(key => [key, null]))
                }
                catch (err) {
                  vitest.state.catchError(err, 'Manual Mock Resolver Error')
                  return {}
                }
              })
              defaultMockerRegistry.add(mock)
            }
            else {
              if (module.type === 'redirect') {
                const redirectUrl = new URL(module.redirect)
                module.redirect = join(vite.config.root, redirectUrl.pathname)
              }
              defaultMockerRegistry.register(module)
            }
            return
          }

          if (module.type === 'manual') {
            const manualModule = ManualMockedModule.fromJSON(module, async () => {
              const { keys } = await rpc.resolveManualMock(module.url)
              return Object.fromEntries(keys.map(key => [key, null]))
            })
            await mocker.register(sessionId, manualModule)
          }
          else if (module.type === 'redirect') {
            await mocker.register(sessionId, RedirectedModule.fromJSON(module))
          }
          else if (module.type === 'automock') {
            await mocker.register(sessionId, AutomockedModule.fromJSON(module))
          }
          else if (module.type === 'autospy') {
            await mocker.register(sessionId, AutospiedModule.fromJSON(module))
          }
        },
        clearMocks(sessionId) {
          if (!mocker) {
            return defaultMockerRegistry.clear()
          }
          return mocker.clear(sessionId)
        },
        unregisterMock(sessionId, id) {
          if (!mocker) {
            return defaultMockerRegistry.delete(id)
          }
          return mocker.delete(sessionId, id)
        },

        // CDP
        async sendCdpEvent(sessionId: string, event: string, payload?: Record<string, unknown>) {
          const cdp = await globalServer.ensureCDPHandler(sessionId, rpcId)
          return cdp.send(event, payload)
        },
        async trackCdpEvent(sessionId: string, type: 'on' | 'once' | 'off', event: string, listenerId: string) {
          const cdp = await globalServer.ensureCDPHandler(sessionId, rpcId)
          cdp[type](event, listenerId)
        },
      },
      {
        post: msg => ws.send(msg),
        on: fn => ws.on('message', fn),
        eventNames: ['onCancel', 'cdpEvent'],
        serialize: (data: any) => stringify(data, stringifyReplace),
        deserialize: parse,
        timeout: -1, // createTesters can take a long time
      },
    )

    const offCancel = vitest.onCancel(reason => rpc.onCancel(reason))

    return { rpc, offCancel }
  }
}

// Serialization support utils.
function cloneByOwnProperties(value: any) {
  // Clones the value's properties into a new Object. The simpler approach of
  // Object.assign() won't work in the case that properties are not enumerable.
  return Object.getOwnPropertyNames(value).reduce(
    (clone, prop) => ({
      ...clone,
      [prop]: value[prop],
    }),
    {},
  )
}

/**
 * Replacer function for serialization methods such as JS.stringify() or
 * flatted.stringify().
 */
export function stringifyReplace(key: string, value: any): any {
  if (value instanceof Error) {
    const cloned = cloneByOwnProperties(value)
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...cloned,
    }
  }
  else {
    return value
  }
}
