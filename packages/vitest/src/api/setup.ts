import { promises as fs } from 'fs'
import type { BirpcReturn } from 'birpc'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import type { ModuleNode } from 'vite'
import { API_PATH } from '../constants'
import type { Vitest } from '../node'
import type { File, Reporter, TaskResultPack } from '../types'
import { shouldExternalize } from '../utils/externalize'
import type { WebSocketEvents, WebSocketHandlers } from './types'

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
    const rpc = createBirpc<WebSocketHandlers, WebSocketEvents>({
      functions: {
        getFiles() {
          return ctx.state.getFiles()
        },
        getSourceCode(id) {
          return fs.readFile(id, 'utf-8')
        },
        async rerun(files) {
          await ctx.report('onWatcherRerun', files)
          await ctx.runFiles(files)
          await ctx.report('onWatcherStart')
        },
        getConfig() {
          return ctx.config
        },
        async getModuleGraph(id: string) {
          const graph: Record<string, string[]> = {}
          function clearId(id?: string | null) {
            return id?.replace(/\?v=\w+$/, '') || ''
          }
          function get(mod?: ModuleNode, seen = new Set<any>()) {
            if (!mod || !mod.id || seen.has(mod))
              return
            seen.add(mod)
            const mods = Array.from(mod.importedModules).filter(i => i.id && !i.id.includes('/vitest/dist/'))
            graph[clearId(mod.id)] = mods.map(i => clearId(i.id)) as string[]
            mods.forEach(m => get(m, seen))
          }
          get(ctx.server.moduleGraph.getModuleById(id))
          const externalized: string[] = []
          const inlined: string[] = []
          await Promise.all(Object.keys(graph).map(async(i) => {
            const rewrote = await shouldExternalize(i, ctx.config)
            if (rewrote)
              externalized.push(rewrote)
            else
              inlined.push(i)
          }))
          return {
            graph,
            externalized,
            inlined,
          }
        },
      },
      post(msg) {
        ws.send(msg)
      },
      on(fn) {
        ws.on('message', fn)
      },
      eventNames: ['onCollected'],
      serialize: stringify,
      deserialize: parse,
    })

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
    this.clients.forEach((client) => {
      client.onCollected?.(files)
    })
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    this.clients.forEach((client) => {
      client.onTaskUpdate?.(packs)
    })
  }
}
