import type { MockerRegistry } from '@vitest/mocker'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import type { TestError } from 'vitest'
import type {
  BrowserCommandContext,
  ResolveSnapshotPathHandlerContext,
  TestProject,
  Vitest,
} from 'vitest/node'
import type { WebSocket } from 'ws'
import type {
  WebSocketBrowserEvents,
  WebSocketBrowserHandlers,
  WebSocketBrowserRPC,
} from '../types'
import type { FactoryExportResolver } from './mocks'
import type { ParentBrowserProject } from './projectParent'
import type { BrowserServerState } from './state'
import { existsSync, promises as fs } from 'node:fs'
import { evaluateSnapshotFile } from '@vitest/snapshot/environment'
import { extractSourcemapFromFile } from '@vitest/utils/source-map/node'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { dirname, resolve } from 'pathe'
import {
  BrowserConnectionError,
  createDebugger,
  isFileLoadingAllowed,
  isValidApiRequest,
} from 'vitest/node'
import { WebSocketServer } from 'ws'
import { replaceUndefined, reviveUndefined } from '../shared/serialization'
import { createMockHandlers } from './mocks'
import { slash } from './utils'

const debug = createDebugger('vitest:browser:api')

const BROWSER_API_PATH = '/__vitest_browser_api__'

const DEFAULT_HEARTBEAT_INTERVAL = 15_000
const HEARTBEAT_MAX_MISSED = 2
let warnedInvalidHeartbeatInterval = false

function resolveHeartbeatInterval(vitest: Vitest): number {
  const rawInterval = process.env.VITEST_BROWSER_HEARTBEAT_INTERVAL
  if (!rawInterval) {
    return DEFAULT_HEARTBEAT_INTERVAL
  }
  const interval = Number(rawInterval)
  if (Number.isNaN(interval)) {
    if (!warnedInvalidHeartbeatInterval) {
      warnedInvalidHeartbeatInterval = true
      vitest.logger.warn(
        `VITEST_BROWSER_HEARTBEAT_INTERVAL is expected to be a number, received "${rawInterval}". Using the default interval of ${DEFAULT_HEARTBEAT_INTERVAL}ms instead.`,
      )
    }
    return DEFAULT_HEARTBEAT_INTERVAL
  }
  return interval
}

export function setupBrowserRpc(
  globalServer: ParentBrowserProject,
  defaultMockerRegistry: MockerRegistry,
  factoryExportResolvers: Map<string, FactoryExportResolver>,
): void {
  const vite = globalServer.vite
  const vitest = globalServer.vitest

  const wss = new WebSocketServer({ noServer: true })

  vite.httpServer?.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
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
        new Error(
          `[vitest] Type query in ${request.url} is invalid. Type should be either "tester" or "orchestrator".`,
        ),
      )
    }

    if (!sessionId || !rpcId || projectName == null) {
      return error(
        new Error(
          `[vitest] Invalid URL ${request.url}. "projectName", "sessionId" and "rpcId" queries are required.`,
        ),
      )
    }

    const sessions = vitest._browserSessions

    if (!sessions.sessionIds.has(sessionId)) {
      if (sessions.closedSessionIds.has(sessionId)) {
        debug?.('[%s] ignoring the %s connection of a closed session', sessionId, type)
        socket.destroy()
        return
      }
      const ids = [...sessions.sessionIds].join(', ')
      return error(new Error(`[vitest] Unknown session id "${sessionId}". Expected one of ${ids}.`))
    }

    if (type === 'orchestrator') {
      const session = sessions.getSession(sessionId)
      // it's possible the session was already resolved by the preview provider,
      // but we still mark the websocket connection when the page reconnects
      session?.connected()
    }

    const project = vitest.getProjectByName(projectName)

    if (!project) {
      return error(new Error(`[vitest] Project "${projectName}" not found.`))
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      // the pool closed this instance, its pages can still reconnect while they close
      if (!project.browser?.provider) {
        ws.terminate()
        return
      }
      wss.emit('connection', ws, request)

      const { rpc, offCancel } = setupClient(project, rpcId, ws, { sessionId })
      const state = project.browser!.state as BrowserServerState
      const clients = type === 'tester' ? state.testers : state.orchestrators
      clients.set(rpcId, rpc)

      debug?.('[%s] Browser API connected to %s', rpcId, type)

      // if the browser stops answering pings, terminate the socket so the
      // "close" handler below rejects pending calls (like `createTesters`)
      // instead of the run hanging forever; timeouts that live in the browser
      // (`testTimeout`, iframe ack) cannot fire once its process is frozen
      const heartbeatInterval = resolveHeartbeatInterval(vitest)
      let missedPongs = 0
      ws.on('pong', () => {
        missedPongs = 0
      })
      const heartbeat =
        heartbeatInterval > 0
          ? setInterval(() => {
              if (ws.readyState !== ws.OPEN) {
                return
              }
              if (missedPongs >= HEARTBEAT_MAX_MISSED) {
                debug?.(
                  '[%s] %s did not respond to %s heartbeat pings, terminating the connection',
                  rpcId,
                  type,
                  missedPongs,
                )
                rpc.$close(
                  new Error(
                    `[vitest] The browser ${type} did not respond to a heartbeat ping for ${missedPongs * heartbeatInterval}ms. The browser process might be frozen or killed. Closing the connection.`,
                  ),
                )
                ws.terminate()
                return
              }
              missedPongs++
              ws.ping()
            }, heartbeatInterval).unref()
          : undefined

      ws.on('close', () => {
        debug?.('[%s] Browser API disconnected from %s', rpcId, type)
        clearInterval(heartbeat)
        offCancel()
        clients.delete(rpcId)
        globalServer.removeCDPHandler(rpcId)
        if (type === 'orchestrator') {
          sessions.destroySession(sessionId)
        }
        // this will reject any hanging methods if there are any
        rpc.$close(
          new BrowserConnectionError(
            `[vitest] Browser connection was closed while running tests. Was the page closed unexpectedly?`,
          ),
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
    return project.config.api.allowWrite && project.vitest.config.api.allowWrite
  }

  function canExec(project: TestProject) {
    return project.config.api.allowExec && project.vitest.config.api.allowExec
  }

  function isCdpAllowed(project: TestProject) {
    return canExec(project) && canWrite(project)
  }

  function assertCdpAllowed(project: TestProject) {
    if (!isCdpAllowed(project)) {
      throw new Error(
        `Cannot use CDP because browser API write or exec operations are disabled. See https://vitest.dev/config/api.`,
      )
    }
  }

  function setupClient(
    project: TestProject,
    rpcId: string,
    ws: WebSocket,
    options: {
      sessionId: string
    },
  ) {
    const rpc: WebSocketBrowserRPC = createBirpc<WebSocketBrowserEvents, WebSocketBrowserHandlers>(
      {
        onOrchestratorReady(capabilities) {
          ;(project.browser!.state as BrowserServerState).lateImportMaps =
            capabilities.lateImportMaps
          const sessions = vitest._browserSessions
          sessions.getSession(options.sessionId)?.ready()
        },
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
          } else {
            await vitest._testRun.enqueued(project, file)
          }
        },
        async onCollected(method, files) {
          if (method === 'collect') {
            vitest.state.collectFiles(project, files)
          } else {
            await vitest._testRun.collected(project, files)
          }
        },
        async onTaskArtifactRecord(id, artifact) {
          if (!canWrite(project)) {
            if (artifact.type === 'internal:annotation' && artifact.annotation.attachment) {
              artifact.annotation.attachment = undefined
              vitest.logger.error(
                `[vitest] Cannot record annotation attachment because file writing is disabled. See https://vitest.dev/config/api.`,
              )
            }
            // remove attachments if cannot write
            if (artifact.attachments?.length) {
              const attachments = artifact.attachments
                .map((n) => n.path)
                .filter((r) => !!r)
                .join('", "')
              artifact.attachments = []
              vitest.logger.error(
                `[vitest] Cannot record attachments ("${attachments}") because file writing is disabled, removing attachments from artifact "${artifact.type}". See https://vitest.dev/config/api.`,
              )
            }
          } else {
            // attachment files are copied into `attachmentsDir`, so confine
            // client-supplied paths to Vite's `server.fs` boundary
            const attachments =
              artifact.type === 'internal:annotation'
                ? artifact.annotation.attachment
                  ? [artifact.annotation.attachment]
                  : []
                : (artifact.attachments ?? [])
            for (const attachment of attachments) {
              const path = attachment.path
              if (path && !path.startsWith('http://') && !path.startsWith('https://')) {
                checkFileAccess(resolve(project.config.root, slash(path)))
              }
            }
          }

          return vitest._testRun.recordArtifact(id, artifact)
        },
        async onTestBenchmark(testId, benchmark) {
          return vitest._testRun.recordBenchmark(testId, benchmark)
        },
        async readBenchmarkResult(relativePath) {
          checkFileAccess(project.benchmark.resolve(slash(relativePath)))
          return project.benchmark.readResult(relativePath)
        },
        async writeBenchmarkResult(relativePath, data) {
          if (!canWrite(project)) {
            vitest.logger.error(
              `[vitest] Cannot write benchmark artifact "${relativePath}" because file writing is disabled. See https://vitest.dev/config/api.`,
            )
            return
          }
          checkFileAccess(project.benchmark.resolve(slash(relativePath)))
          return project.benchmark.writeResult(relativePath, data)
        },
        async onTaskUpdate(method, packs, events) {
          if (method === 'collect') {
            vitest.state.updateTasks(packs)
          } else {
            await vitest._testRun.updated(packs, events)
          }
        },
        onAfterSuiteRun(meta) {
          vitest.coverageProvider?.onAfterSuiteRun(meta)
        },
        async sendLog(method, log) {
          if (method === 'collect') {
            vitest.state.updateUserLog(log)
          } else {
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
        async readSnapshotFileData(snapshotPath) {
          checkFileAccess(snapshotPath)
          if (!existsSync(snapshotPath)) {
            return null
          }
          if (!canExec(project)) {
            throw new Error(
              `Cannot read snapshot file because browser API exec operations are disabled. See https://vitest.dev/config/api.`,
            )
          }
          const content = await fs.readFile(snapshotPath, 'utf-8')
          return evaluateSnapshotFile(snapshotPath, content)
        },
        async saveSnapshotFile(id, content) {
          checkFileAccess(id)
          if (!canWrite(project)) {
            vitest.logger.error(
              `[vitest] Cannot save snapshot file "${id}". File writing is disabled because server is exposed to the internet, see https://vitest.dev/config/api.`,
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
              `[vitest] Cannot remove snapshot file "${id}". File writing is disabled because server is exposed to the internet, see https://vitest.dev/config/api.`,
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
        debug(...args) {
          vitest.logger.console.debug(...args)
        },
        getCountOfFailedTests() {
          return vitest.state.getCountOfFailedTests()
        },
        async wdioSwitchContext(direction) {
          const provider = project.browser?.provider
          if (!provider) {
            throw new Error(`The browser of the "${project.name}" project is closed.`)
          }
          if (provider.name !== 'webdriverio') {
            throw new Error('Switch context is only available for WebDriverIO provider.')
          }
          if (direction === 'iframe') {
            await (provider as any).switchToTestFrame()
          } else {
            await (provider as any).switchToMainFrame()
          }
        },
        async triggerCommand(sessionId, command, testPath, payload) {
          debug?.('[%s] Triggering command "%s"', sessionId, command)
          const provider = project.browser?.provider
          if (!provider) {
            throw new Error(
              `Cannot run the "${command}" command because the browser of the "${project.name}" project is closed.`,
            )
          }
          const context = Object.assign(
            {
              testPath,
              project,
              provider,
              contextId: sessionId,
              sessionId,
              mark: async (name: string, options?: any) => {
                const tester = (project.browser!.state as BrowserServerState).testers.get(rpcId)
                await tester?.pageMark(name, options)
              },
              triggerCommand: (name: string, ...args: any[]) => {
                return project.browser!.triggerCommand(name as any, context, ...args)
              },
              __ensureCDPHandler: () => globalServer.ensureCDPHandler(sessionId, rpcId),
            },
            provider.getCommandsContext(sessionId),
          ) as any as BrowserCommandContext
          return await project.browser!.triggerCommand(command as any, context, ...payload)
        },
        ...createMockHandlers(project, {
          registry: defaultMockerRegistry,
          factoryExportResolvers,
          checkFileAccess,
          rpc: () => rpc,
        }),

        // CDP
        async sendCdpEvent(sessionId: string, event: string, payload?: Record<string, unknown>) {
          assertCdpAllowed(project)
          const cdp = await globalServer.ensureCDPHandler(sessionId, rpcId)
          return cdp.send(event, payload)
        },
        async trackCdpEvent(
          sessionId: string,
          type: 'on' | 'once' | 'off',
          event: string,
          listenerId: string,
        ) {
          assertCdpAllowed(project)
          const cdp = await globalServer.ensureCDPHandler(sessionId, rpcId)
          cdp[type](event, listenerId)
        },
      },
      {
        post: (msg) => ws.send(msg),
        on: (fn) => ws.on('message', fn),
        eventNames: ['onCancel', 'cdpEvent'],
        serialize: (data: any) => stringify(data, stringifyReplace),
        deserialize: (data) => parse(data, reviveUndefined),
        timeout: -1, // createTesters can take a long time
      },
    )

    const offCancel = vitest.onCancel((reason) => rpc.onCancel(reason))

    return { rpc, offCancel }
  }
}

// Serialization support utils.
function cloneByOwnProperties(value: any) {
  // Clones the value's properties into a new Object. The simpler approach of
  // Object.assign() won't work in the case that properties are not enumerable.
  const clone: Record<string, unknown> = {}
  for (const prop of Object.getOwnPropertyNames(value)) {
    clone[prop] = value[prop]
  }
  return clone
}

/**
 * Replacer function for serialization methods such as JS.stringify() or
 * flatted.stringify().
 */
function stringifyReplace(key: string, value: any): any {
  if (value instanceof Error) {
    const cloned = cloneByOwnProperties(value)
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...cloned,
    }
  } else {
    return replaceUndefined(value)
  }
}
