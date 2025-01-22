import type { Duplex } from 'node:stream'
import type { ErrorWithDiff } from 'vitest'
import type { BrowserCommandContext, ResolveSnapshotPathHandlerContext, TestProject } from 'vitest/node'
import type { WebSocket } from 'ws'
import type { ParentBrowserProject } from './projectParent'
import type { BrowserServerState } from './state'
import type { WebSocketBrowserEvents, WebSocketBrowserHandlers } from './types'
import { existsSync, promises as fs } from 'node:fs'
import { ServerMockResolver } from '@vitest/mocker/node'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { dirname } from 'pathe'
import { createDebugger, isFileServingAllowed, isValidApiRequest } from 'vitest/node'
import { WebSocketServer } from 'ws'

const debug = createDebugger('vitest:browser:api')

const BROWSER_API_PATH = '/__vitest_browser_api__'

export function setupBrowserRpc(globalServer: ParentBrowserProject) {
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

    const method = searchParams.get('method') as 'run' | 'collect'
    if (method !== 'run' && method !== 'collect') {
      return error(
        new Error(`[vitest] Method query in ${request.url} is invalid. Method should be either "run" or "collect".`),
      )
    }

    if (type === 'orchestrator') {
      const session = vitest._browserSessions.getSession(sessionId)
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

      const rpc = setupClient(project, rpcId, ws, method)
      const state = project.browser!.state as BrowserServerState
      const clients = type === 'tester' ? state.testers : state.orchestrators
      clients.set(rpcId, rpc)

      debug?.('[%s] Browser API connected to %s', rpcId, type)

      ws.on('close', () => {
        debug?.('[%s] Browser API disconnected from %s', rpcId, type)
        clients.delete(rpcId)
        globalServer.removeCDPHandler(rpcId)
      })
    })
  })

  // we don't throw an error inside a stream because this can segfault the process
  function error(err: Error) {
    console.error(err)
    vitest.state.catchError(err, 'RPC Error')
  }

  function checkFileAccess(path: string) {
    if (!isFileServingAllowed(path, vite)) {
      throw new Error(
        `Access denied to "${path}". See Vite config documentation for "server.fs": https://vitejs.dev/config/server-options.html#server-fs-strict.`,
      )
    }
  }

  function setupClient(project: TestProject, rpcId: string, ws: WebSocket, method: 'run' | 'collect') {
    const mockResolver = new ServerMockResolver(globalServer.vite, {
      moduleDirectories: project.config.server?.deps?.moduleDirectories,
    })

    const rpc = createBirpc<WebSocketBrowserEvents, WebSocketBrowserHandlers>(
      {
        async onUnhandledError(error, type) {
          if (error && typeof error === 'object') {
            const _error = error as ErrorWithDiff
            _error.stacks = globalServer.parseErrorStacktrace(_error)
          }
          vitest.state.catchError(error, type)
        },
        async onQueued(file) {
          if (method === 'collect') {
            vitest.state.collectFiles(project, [file])
          }
          else {
            await vitest._testRun.enqueued(project, file)
          }
        },
        async onCollected(files) {
          if (method === 'collect') {
            vitest.state.collectFiles(project, files)
          }
          else {
            await vitest._testRun.collected(project, files)
          }
        },
        async onTaskUpdate(packs, events) {
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
        async sendLog(log) {
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
          await fs.mkdir(dirname(id), { recursive: true })
          return fs.writeFile(id, content, 'utf-8')
        },
        async removeSnapshotFile(id) {
          checkFileAccess(id)
          if (!existsSync(id)) {
            throw new Error(`Snapshot file "${id}" does not exist.`)
          }
          return fs.unlink(id)
        },
        getBrowserFileSourceMap(id) {
          const mod = globalServer.vite.moduleGraph.getModuleById(id)
          return mod?.transformResult?.map
        },
        onCancel(reason) {
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
        async triggerCommand(sessionId, command, testPath, payload) {
          debug?.('[%s] Triggering command "%s"', sessionId, command)
          const provider = project.browser!.provider
          if (!provider) {
            throw new Error('Commands are only available for browser tests.')
          }
          const commands = globalServer.commands
          if (!commands || !commands[command]) {
            throw new Error(`Unknown command "${command}".`)
          }
          await provider.beforeCommand?.(command, payload)
          const context = Object.assign(
            {
              testPath,
              project,
              provider,
              contextId: sessionId,
              sessionId,
            },
            provider.getCommandsContext(sessionId),
          ) as any as BrowserCommandContext
          let result
          try {
            result = await commands[command](context, ...payload)
          }
          finally {
            await provider.afterCommand?.(command, payload)
          }
          return result
        },
        finishBrowserTests(sessionId: string) {
          debug?.('[%s] Finishing browser tests for session', sessionId)
          return vitest._browserSessions.getSession(sessionId)?.resolve()
        },
        resolveMock(rawId, importer, options) {
          return mockResolver.resolveMock(rawId, importer, options)
        },
        invalidate(ids) {
          return mockResolver.invalidate(ids)
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
        onTimeoutError(functionName) {
          throw new Error(`[vitest-api]: Timeout calling "${functionName}"`)
        },
      },
    )

    vitest.onCancel(reason => rpc.onCancel(reason))

    return rpc
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
export function stringifyReplace(key: string, value: any) {
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
