import type { File, TaskResultPack } from '@vitest/runner'

import type { IncomingMessage } from 'node:http'
import type { ViteDevServer } from 'vite'
import type { WebSocket } from 'ws'
import type { Vitest } from '../node/core'
import type { Reporter } from '../node/types/reporter'
import type { SerializedTestSpecification } from '../runtime/types/utils'
import type { Awaitable, ModuleGraphData, UserConsoleLog } from '../types/general'
import type {
  TransformResultWithSource,
  WebSocketEvents,
  WebSocketHandlers,
  WebSocketRPC,
} from './types'
import { existsSync, promises as fs } from 'node:fs'
import { isPrimitive, noop } from '@vitest/utils'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { WebSocketServer } from 'ws'
import { API_PATH } from '../constants'
import { getModuleGraph } from '../utils/graph'
import { stringifyReplace } from '../utils/serialization'
import { parseErrorStacktrace } from '../utils/source-map'
import { isValidApiRequest } from './check'

export function setup(ctx: Vitest, _server?: ViteDevServer) {
  const wss = new WebSocketServer({ noServer: true })

  const clients = new Map<WebSocket, WebSocketRPC>()

  const server = _server || ctx.server

  server.httpServer?.on('upgrade', (request: IncomingMessage, socket, head) => {
    if (!request.url) {
      return
    }

    const { pathname } = new URL(request.url, 'http://localhost')
    if (pathname !== API_PATH) {
      return
    }

    if (!isValidApiRequest(ctx.config, request)) {
      socket.destroy()
      return
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
      setupClient(ws)
    })
  })

  function setupClient(ws: WebSocket) {
    const rpc = createBirpc<WebSocketEvents, WebSocketHandlers>(
      {
        async onTaskUpdate(packs, events) {
          await ctx._testRun.updated(packs, events)
        },
        getFiles() {
          return ctx.state.getFiles()
        },
        getPaths() {
          return ctx.state.getPaths()
        },
        async readTestFile(id) {
          if (!ctx.state.filesMap.has(id) || !existsSync(id)) {
            return null
          }
          return fs.readFile(id, 'utf-8')
        },
        async saveTestFile(id, content) {
          if (!ctx.state.filesMap.has(id) || !existsSync(id)) {
            throw new Error(
              `Test file "${id}" was not registered, so it cannot be updated using the API.`,
            )
          }
          return fs.writeFile(id, content, 'utf-8')
        },
        async rerun(files, resetTestNamePattern) {
          await ctx.rerunFiles(files, undefined, true, resetTestNamePattern)
        },
        async rerunTask(id) {
          await ctx.rerunTask(id)
        },
        getConfig() {
          return ctx.getRootProject().serializedConfig
        },
        getResolvedProjectNames(): string[] {
          return ctx.resolvedProjects.map(p => p.name)
        },
        async getTransformResult(projectName: string, id, browser = false) {
          const project = ctx.getProjectByName(projectName)
          const result: TransformResultWithSource | null | undefined = browser
            ? await project.browser!.vite.transformRequest(id)
            : await project.vitenode.transformRequest(id)
          if (result) {
            try {
              result.source = result.source || (await fs.readFile(id, 'utf-8'))
            }
            catch {}
            return result
          }
        },
        async getModuleGraph(project, id, browser): Promise<ModuleGraphData> {
          return getModuleGraph(ctx, project, id, browser)
        },
        async updateSnapshot(file?: File) {
          if (!file) {
            await ctx.updateSnapshot()
          }
          else {
            await ctx.updateSnapshot([file.filepath])
          }
        },
        getUnhandledErrors() {
          return ctx.state.getUnhandledErrors()
        },
        async getTestFiles() {
          const spec = await ctx.globTestSpecifications()
          return spec.map(spec => [
            {
              name: spec.project.config.name,
              root: spec.project.config.root,
            },
            spec.moduleId,
            { pool: spec.pool },
          ])
        },
      },
      {
        post: msg => ws.send(msg),
        on: fn => ws.on('message', fn),
        eventNames: [
          'onUserConsoleLog',
          'onFinished',
          'onFinishedReportCoverage',
          'onCollected',
          'onTaskUpdate',
        ],
        serialize: (data: any) => stringify(data, stringifyReplace),
        deserialize: parse,
        onTimeoutError(functionName) {
          throw new Error(`[vitest-api]: Timeout calling "${functionName}"`)
        },
      },
    )

    clients.set(ws, rpc)

    ws.on('close', () => {
      clients.delete(ws)
    })
  }

  ctx.reporters.push(new WebSocketReporter(ctx, wss, clients))
}

export class WebSocketReporter implements Reporter {
  constructor(
    public ctx: Vitest,
    public wss: WebSocketServer,
    public clients: Map<WebSocket, WebSocketRPC>,
  ) {}

  onCollected(files?: File[]) {
    if (this.clients.size === 0) {
      return
    }
    this.clients.forEach((client) => {
      client.onCollected?.(files)?.catch?.(noop)
    })
  }

  onSpecsCollected(specs?: SerializedTestSpecification[] | undefined): Awaitable<void> {
    if (this.clients.size === 0) {
      return
    }
    this.clients.forEach((client) => {
      client.onSpecsCollected?.(specs)?.catch?.(noop)
    })
  }

  async onTaskUpdate(packs: TaskResultPack[]) {
    if (this.clients.size === 0) {
      return
    }

    packs.forEach(([taskId, result]) => {
      const task = this.ctx.state.idMap.get(taskId)
      const isBrowser = task && task.file.pool === 'browser'

      result?.errors?.forEach((error) => {
        if (isPrimitive(error)) {
          return
        }

        if (isBrowser) {
          const project = this.ctx.getProjectByName(task!.file.projectName || '')
          error.stacks = project.browser?.parseErrorStacktrace(error)
        }
        else {
          error.stacks = parseErrorStacktrace(error)
        }
      })
    })

    this.clients.forEach((client) => {
      client.onTaskUpdate?.(packs)?.catch?.(noop)
    })
  }

  onFinished(files: File[], errors: unknown[]) {
    this.clients.forEach((client) => {
      client.onFinished?.(files, errors)?.catch?.(noop)
    })
  }

  onFinishedReportCoverage() {
    this.clients.forEach((client) => {
      client.onFinishedReportCoverage?.()?.catch?.(noop)
    })
  }

  onUserConsoleLog(log: UserConsoleLog) {
    this.clients.forEach((client) => {
      client.onUserConsoleLog?.(log)?.catch?.(noop)
    })
  }
}
