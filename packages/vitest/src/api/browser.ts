import { existsSync, promises as fs } from 'node:fs'

import { dirname } from 'pathe'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import { isFileServingAllowed } from 'vite'
import type { ViteDevServer } from 'vite'
import { BROWSER_API_PATH } from '../constants'
import { stringifyReplace } from '../utils'
import type { WorkspaceProject } from '../node/workspace'
import type { WebSocketBrowserEvents, WebSocketBrowserHandlers } from './types'

export function setupBrowserRpc(project: WorkspaceProject, server: ViteDevServer) {
  const ctx = project.ctx

  const wss = new WebSocketServer({ noServer: true })

  server.httpServer?.on('upgrade', (request, socket, head) => {
    if (!request.url)
      return

    const { pathname, searchParams } = new URL(request.url, 'http://localhost')
    if (pathname !== BROWSER_API_PATH)
      return

    const type = searchParams.get('type') ?? 'tester'
    const sessionId = searchParams.get('sessionId') ?? '0'

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)

      const rpc = setupClient(sessionId, ws)
      const rpcs = project.browserRpc
      const clients = type === 'tester' ? rpcs.testers : rpcs.orchestrators
      clients.set(sessionId, rpc)

      ws.on('close', () => {
        clients.delete(sessionId)
      })
    })
  })

  function checkFileAccess(path: string) {
    if (!isFileServingAllowed(path, server))
      throw new Error(`Access denied to "${path}". See Vite config documentation for "server.fs": https://vitejs.dev/config/server-options.html#server-fs-strict.`)
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
          if (!existsSync(snapshotPath))
            return null
          return fs.readFile(snapshotPath, 'utf-8')
        },
        async saveSnapshotFile(id, content) {
          checkFileAccess(id)
          await fs.mkdir(dirname(id), { recursive: true })
          return fs.writeFile(id, content, 'utf-8')
        },
        async removeSnapshotFile(id) {
          checkFileAccess(id)
          if (!existsSync(id))
            throw new Error(`Snapshot file "${id}" does not exist.`)
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
          const result = await project.server.pluginContainer.resolveId(id, importer, {
            ssr: false,
          })
          return result?.id ?? null
        },
        debug(...args) {
          ctx.logger.console.debug(...args)
        },
        getCountOfFailedTests() {
          return ctx.state.getCountOfFailedTests()
        },
        triggerCommand(command: string, testPath: string | undefined, payload: unknown[]) {
          if (!project.browserProvider)
            throw new Error('Commands are only available for browser tests.')
          const commands = project.config.browser?.commands
          if (!commands || !commands[command])
            throw new Error(`Unknown command "${command}".`)
          return commands[command]({
            testPath,
            project,
            provider: project.browserProvider,
          }, ...payload)
        },
        getBrowserFiles() {
          return project.browserState?.files ?? []
        },
        finishBrowserTests() {
          return project.browserState?.resolve()
        },
        getProvidedContext() {
          return 'ctx' in project ? project.getProvidedContext() : ({} as any)
        },
        async queueMock(id: string, importer: string, hasFactory: boolean) {
          return project.browserMocker.mock(sessionId, id, importer, hasFactory)
        },
        async queueUnmock(id: string, importer: string) {
          return project.browserMocker.unmock(id, importer)
        },
        invalidateMocks() {
          const mocker = project.browserMocker
          mocker.mocks.forEach((_, id) => {
            mocker.invalidateModuleById(id)
          })
          mocker.mocks.clear()
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
