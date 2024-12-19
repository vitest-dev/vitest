import type { ErrorWithDiff } from 'vitest'
import type { BrowserCommandContext, ResolveSnapshotPathHandlerContext, TestModule } from 'vitest/node'
import type { WebSocket } from 'ws'
import type { BrowserServer } from './server'
import type { WebSocketBrowserEvents, WebSocketBrowserHandlers } from './types'
import { existsSync, promises as fs } from 'node:fs'
import { ServerMockResolver } from '@vitest/mocker/node'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { dirname } from 'pathe'
import { createDebugger, isFileServingAllowed } from 'vitest/node'
import { WebSocketServer } from 'ws'

const debug = createDebugger('vitest:browser:api')

const BROWSER_API_PATH = '/__vitest_browser_api__'

export function setupBrowserRpc(server: BrowserServer) {
  const project = server.project
  const vite = server.vite
  const ctx = project.ctx

  const wss = new WebSocketServer({ noServer: true })

  vite.httpServer?.on('upgrade', (request, socket, head) => {
    if (!request.url) {
      return
    }

    const { pathname, searchParams } = new URL(request.url, 'http://localhost')
    if (pathname !== BROWSER_API_PATH) {
      return
    }

    const type = searchParams.get('type') ?? 'tester'
    const sessionId = searchParams.get('sessionId') ?? '0'

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)

      const rpc = setupClient(sessionId, ws)
      const state = server.state
      const clients = type === 'tester' ? state.testers : state.orchestrators
      clients.set(sessionId, rpc)

      debug?.('[%s] Browser API connected to %s', sessionId, type)

      ws.on('close', () => {
        debug?.('[%s] Browser API disconnected from %s', sessionId, type)
        clients.delete(sessionId)
        server.state.removeCDPHandler(sessionId)
      })
    })
  })

  function checkFileAccess(path: string) {
    if (!isFileServingAllowed(path, vite)) {
      throw new Error(
        `Access denied to "${path}". See Vite config documentation for "server.fs": https://vitejs.dev/config/server-options.html#server-fs-strict.`,
      )
    }
  }

  function setupClient(sessionId: string, ws: WebSocket) {
    const mockResolver = new ServerMockResolver(server.vite, {
      moduleDirectories: project.config.server?.deps?.moduleDirectories,
    })

    const rpc = createBirpc<WebSocketBrowserEvents, WebSocketBrowserHandlers>(
      {
        async onUnhandledError(error, type) {
          if (error && typeof error === 'object') {
            const _error = error as ErrorWithDiff
            _error.stacks = server.parseErrorStacktrace(_error)
          }
          ctx.state.catchError(error, type)
        },
        async onQueued(file) {
          ctx.state.collectFiles(project, [file])
          const testModule = ctx.state.getReportedEntity(file) as TestModule
          await ctx.report('onTestModuleQueued', testModule)
        },
        async onCollected(files) {
          ctx.state.collectFiles(project, files)
          await ctx.report('onCollected', files)
        },
        async onTaskUpdate(packs) {
          ctx.state.updateTasks(packs)
          await ctx.report('onTaskUpdate', packs)
        },
        onAfterSuiteRun(meta) {
          ctx.coverageProvider?.onAfterSuiteRun(meta)
        },
        sendLog(log) {
          return ctx.report('onUserConsoleLog', log)
        },
        resolveSnapshotPath(testPath) {
          return ctx.snapshot.resolvePath<ResolveSnapshotPathHandlerContext>(testPath, {
            config: project.getSerializableConfig(),
          })
        },
        resolveSnapshotRawPath(testPath, rawPath) {
          return ctx.snapshot.resolveRawPath(testPath, rawPath)
        },
        snapshotSaved(snapshot) {
          ctx.snapshot.add(snapshot)
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
          const mod = server.vite.moduleGraph.getModuleById(id)
          return mod?.transformResult?.map
        },
        onCancel(reason) {
          ctx.cancelCurrentRun(reason)
        },
        async resolveId(id, importer) {
          return mockResolver.resolveId(id, importer)
        },
        debug(...args) {
          ctx.logger.console.debug(...args)
        },
        getCountOfFailedTests() {
          return ctx.state.getCountOfFailedTests()
        },
        async triggerCommand(contextId, command, testPath, payload) {
          debug?.('[%s] Triggering command "%s"', contextId, command)
          const provider = server.provider
          if (!provider) {
            throw new Error('Commands are only available for browser tests.')
          }
          const commands = project.config.browser?.commands
          if (!commands || !commands[command]) {
            throw new Error(`Unknown command "${command}".`)
          }
          if (provider.beforeCommand) {
            await provider.beforeCommand(command, payload)
          }
          const context = Object.assign(
            {
              testPath,
              project,
              provider,
              contextId,
            },
            provider.getCommandsContext(contextId),
          ) as any as BrowserCommandContext
          let result
          try {
            result = await commands[command](context, ...payload)
          }
          finally {
            if (provider.afterCommand) {
              await provider.afterCommand(command, payload)
            }
          }
          return result
        },
        finishBrowserTests(contextId: string) {
          debug?.('[%s] Finishing browser tests for context', contextId)
          return server.state.getContext(contextId)?.resolve()
        },
        resolveMock(rawId, importer, options) {
          return mockResolver.resolveMock(rawId, importer, options)
        },
        invalidate(ids) {
          return mockResolver.invalidate(ids)
        },

        // CDP
        async sendCdpEvent(contextId: string, event: string, payload?: Record<string, unknown>) {
          const cdp = await server.ensureCDPHandler(contextId, sessionId)
          return cdp.send(event, payload)
        },
        async trackCdpEvent(contextId: string, type: 'on' | 'once' | 'off', event: string, listenerId: string) {
          const cdp = await server.ensureCDPHandler(contextId, sessionId)
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

    ctx.onCancel(reason => rpc.onCancel(reason))

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
