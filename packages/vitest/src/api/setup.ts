import { existsSync, promises as fs } from 'node:fs'

import type { BirpcReturn } from 'birpc'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import { API_PATH } from '../constants'
import type { Vitest } from '../node'
import type { File, ModuleGraphData, Reporter, TaskResultPack, UserConsoleLog } from '../types'
import { getModuleGraph } from '../utils'
import { parseErrorStacktrace } from '../utils/source-map'
import type { TransformResultWithSource, WebSocketEvents, WebSocketHandlers } from './types'

export function setup(ctx: Vitest) {
  const wss = new WebSocketServer({ noServer: true })

  const clients = new Map<WebSocket, BirpcReturn<WebSocketEvents>>()

  ctx.server.httpServer?.on('upgrade', (request, socket, head) => {
    if (!request.url)
      return

    const { pathname } = new URL(request.url, 'http://localhost')
    if (pathname !== API_PATH)
      return

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
      setupClient(ws)
    })
  })

  function setupClient(ws: WebSocket) {
    const rpc = createBirpc<WebSocketEvents, WebSocketHandlers>(
      {
        async onWatcherStart() {
          await ctx.report('onWatcherStart')
        },
        async onFinished() {
          await ctx.report('onFinished')
          if (ctx.runMode && ctx.config.browser)
            await ctx.exit(true)
        },
        async onCollected(files) {
          ctx.state.collectFiles(files)
          await ctx.report('onCollected', files)
        },
        async onTaskUpdate(packs) {
          ctx.state.updateTasks(packs)
          await ctx.report('onTaskUpdate', packs)
        },
        getFiles() {
          return ctx.state.getFiles()
        },
        getPaths() {
          return ctx.state.getPaths()
        },
        resolveSnapshotPath(testPath) {
          return ctx.snapshot.resolvePath(testPath)
        },
        removeFile(id) {
          return fs.unlink(id)
        },
        createDirectory(id) {
          return fs.mkdir(id, { recursive: true })
        },
        async readFile(id) {
          if (!existsSync(id))
            return null
          return fs.readFile(id, 'utf-8')
        },
        snapshotSaved(snapshot) {
          ctx.snapshot.add(snapshot)
        },
        writeFile(id, content) {
          return fs.writeFile(id, content, 'utf-8')
        },
        async rerun(files) {
          await ctx.rerunFiles(files)
        },
        getConfig() {
          return ctx.config
        },
        async getTransformResult(id) {
          const result: TransformResultWithSource | null | undefined = await ctx.vitenode.transformRequest(id)
          if (result) {
            try {
              result.source = result.source || (await fs.readFile(id, 'utf-8'))
            }
            catch {}
            return result
          }
        },
        async getModuleGraph(id: string): Promise<ModuleGraphData> {
          return getModuleGraph(ctx, id)
        },
        updateSnapshot(file?: File) {
          if (!file)
            return ctx.updateSnapshot()
          return ctx.updateSnapshot([file.filepath])
        },
      },
      {
        post: msg => ws.send(msg),
        on: fn => ws.on('message', fn),
        eventNames: ['onUserConsoleLog', 'onFinished', 'onCollected'],
        serialize: stringify,
        deserialize: parse,
      },
    )

    clients.set(ws, rpc)

    ws.on('close', () => {
      clients.delete(ws)
    })
  }

  ctx.reporters.push(new WebSocketReporter(ctx, wss, clients))
}

class WebSocketReporter implements Reporter {
  constructor(
    public ctx: Vitest,
    public wss: WebSocketServer,
    public clients: Map<WebSocket, BirpcReturn<WebSocketEvents>>,
  ) {}

  onCollected(files?: File[]) {
    if (this.clients.size === 0)
      return
    this.clients.forEach((client) => {
      client.onCollected?.(files)
    })
  }

  async onTaskUpdate(packs: TaskResultPack[]) {
    if (this.clients.size === 0)
      return

    packs.forEach(([, result]) => {
      // TODO remove after "error" deprecation is removed
      if (result?.error)
        result.error.stacks = parseErrorStacktrace(result.error)
      result?.errors?.forEach((error) => {
        error.stacks = parseErrorStacktrace(error)
      })
    })

    this.clients.forEach((client) => {
      client.onTaskUpdate?.(packs)
    })
  }

  onFinished(files?: File[] | undefined) {
    this.clients.forEach((client) => {
      client.onFinished?.(files)
    })
  }

  onUserConsoleLog(log: UserConsoleLog) {
    this.clients.forEach((client) => {
      client.onUserConsoleLog?.(log)
    })
  }
}
