import { existsSync, promises as fs } from 'node:fs'

import { dirname } from 'pathe'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import { isFileServingAllowed, parseAst } from 'vite'
import type { ViteDevServer } from 'vite'
import type { EncodedSourceMap } from '@ampproject/remapping'
import remapping from '@ampproject/remapping'
import { BROWSER_API_PATH } from '../constants'
import { stringifyReplace } from '../utils'
import type { WorkspaceProject } from '../node/workspace'
import { createDebugger } from '../utils/debugger'
import { automockModule } from '../node/automockBrowser'
import type { BrowserCommandContext } from '../types/browser'
import type { WebSocketBrowserEvents, WebSocketBrowserHandlers } from './types'

const debug = createDebugger('vitest:browser:api')

export function setupBrowserRpc(
  project: WorkspaceProject,
  server: ViteDevServer,
) {
  const ctx = project.ctx

  const wss = new WebSocketServer({ noServer: true })

  server.httpServer?.on('upgrade', (request, socket, head) => {
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
      const rpcs = project.browserRpc
      const clients = type === 'tester' ? rpcs.testers : rpcs.orchestrators
      clients.set(sessionId, rpc)

      debug?.('[%s] Browser API connected to %s', sessionId, type)

      ws.on('close', () => {
        debug?.('[%s] Browser API disconnected from %s', sessionId, type)
        clients.delete(sessionId)
      })
    })
  })

  function checkFileAccess(path: string) {
    if (!isFileServingAllowed(path, server)) {
      throw new Error(
        `Access denied to "${path}". See Vite config documentation for "server.fs": https://vitejs.dev/config/server-options.html#server-fs-strict.`,
      )
    }
  }

  function setupClient(sessionId: string, ws: WebSocket) {
    const rpc = createBirpc<WebSocketBrowserEvents, WebSocketBrowserHandlers>(
      {
        async onUnhandledError(error, type) {
          ctx.state.catchError(error, type)
        },
        async onCollected(files) {
          ctx.state.collectFiles(files)
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
          return ctx.snapshot.resolvePath(testPath)
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
        async getBrowserFileSourceMap(id) {
          const mod = project.browser?.moduleGraph.getModuleById(id)
          return mod?.transformResult?.map
        },
        onCancel(reason) {
          ctx.cancelCurrentRun(reason)
        },
        async resolveId(id, importer) {
          const result = await project.server.pluginContainer.resolveId(
            id,
            importer,
            {
              ssr: false,
            },
          )
          return result
        },
        debug(...args) {
          ctx.logger.console.debug(...args)
        },
        getCountOfFailedTests() {
          return ctx.state.getCountOfFailedTests()
        },
        async triggerCommand(contextId, command, testPath, payload) {
          debug?.('[%s] Triggering command "%s"', contextId, command)
          const provider = project.browserProvider
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
          return project.browserState.get(contextId)?.resolve()
        },
        getProvidedContext() {
          return 'ctx' in project ? project.getProvidedContext() : ({} as any)
        },
        // TODO: cache this automock result
        async automock(id) {
          const result = await project.browser!.transformRequest(id)
          if (!result) {
            throw new Error(`Module "${id}" not found.`)
          }
          const ms = automockModule(result.code, parseAst)
          const code = ms.toString()
          const sourcemap = ms.generateMap({ hires: 'boundary', source: id })
          const combinedMap
            = result.map && result.map.mappings
              ? remapping(
                [
                  { ...sourcemap, version: 3 },
                  result.map as EncodedSourceMap,
                ],
                () => null,
              )
              : sourcemap
          return `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(
            JSON.stringify(combinedMap),
          ).toString('base64')}`
        },
        resolveMock(rawId, importer, hasFactory) {
          return project.browserMocker.resolveMock(rawId, importer, hasFactory)
        },
        invalidate(ids) {
          ids.forEach((id) => {
            const moduleGraph = project.browser!.moduleGraph
            const module = moduleGraph.getModuleById(id)
            if (module) {
              moduleGraph.invalidateModule(module, new Set(), Date.now(), true)
            }
          })
        },
      },
      {
        post: msg => ws.send(msg),
        on: fn => ws.on('message', fn),
        eventNames: ['onCancel'],
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
