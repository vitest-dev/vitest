import type { File, TaskEventPack, TaskResultPack, TestAnnotation, TestArtifact } from '@vitest/runner'
import type { SerializedError } from '@vitest/utils'
import type { IncomingMessage } from 'node:http'
import type { ViteDevServer } from 'vite'
import type { WebSocket } from 'ws'
import type { Vitest } from '../node/core'
import type { TestCase, TestModule } from '../node/reporters/reported-tasks'
import type { TestSpecification } from '../node/test-specification'
import type { Reporter } from '../node/types/reporter'
import type { LabelColor, ModuleGraphData, UserConsoleLog } from '../types/general'
import type {
  ExternalResult,
  TransformResultWithSource,
  WebSocketEvents,
  WebSocketHandlers,
  WebSocketRPC,
} from './types'
import { existsSync, promises as fs } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { noop } from '@vitest/utils/helpers'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { WebSocketServer } from 'ws'
import { API_PATH } from '../constants'
import { isFileServingAllowed } from '../node/vite'
import { getTestFileEnvironment } from '../utils/environments'
import { getModuleGraph } from '../utils/graph'
import { stringifyReplace } from '../utils/serialization'
import { isValidApiRequest } from './check'

export function setup(ctx: Vitest, _server?: ViteDevServer): void {
  const wss = new WebSocketServer({ noServer: true })

  const clients = new Map<WebSocket, WebSocketRPC>()

  const server = _server || ctx.vite

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
          // silently ignore write attempts if not allowed
          if (!ctx.config.api.allowWrite) {
            return
          }
          return fs.writeFile(id, content, 'utf-8')
        },
        async rerun(files, resetTestNamePattern) {
          // silently ignore exec attempts if not allowed
          if (!ctx.config.api.allowExec) {
            return
          }
          await ctx.rerunFiles(files, undefined, true, resetTestNamePattern)
        },
        async rerunTask(id) {
          // silently ignore exec attempts if not allowed
          if (!ctx.config.api.allowExec) {
            return
          }
          await ctx.rerunTask(id)
        },
        getConfig() {
          return ctx.getRootProject().serializedConfig
        },
        getResolvedProjectLabels(): { name: string; color?: LabelColor }[] {
          return ctx.projects.map(p => ({ name: p.name, color: p.color }))
        },
        async getExternalResult(moduleId: string, testFileTaskId: string) {
          const testModule = ctx.state.getReportedEntityById(testFileTaskId) as TestModule | undefined
          if (!testModule) {
            return undefined
          }

          if (!isFileServingAllowed(testModule.project.vite.config, moduleId)) {
            return undefined
          }

          const result: ExternalResult = {}

          try {
            result.source = await fs.readFile(moduleId, 'utf-8')
          }
          catch {}

          return result
        },
        async getTransformResult(projectName: string, moduleId, testFileTaskId, browser = false) {
          const project = ctx.getProjectByName(projectName)
          const testModule = ctx.state.getReportedEntityById(testFileTaskId) as TestModule | undefined
          if (!testModule || !isFileServingAllowed(project.vite.config, moduleId)) {
            return
          }

          const environment = getTestFileEnvironment(project, testModule.moduleId, browser)

          const moduleNode = environment?.moduleGraph.getModuleById(moduleId)
          if (!environment || !moduleNode?.transformResult) {
            return
          }

          const result: TransformResultWithSource = moduleNode.transformResult
          try {
            result.source = result.source || (moduleNode.file ? await fs.readFile(moduleNode.file, 'utf-8') : undefined)
          }
          catch {}

          // TODO: store this in HTML reporter separetly
          const transformDuration = ctx.state.metadata[projectName]?.duration[moduleNode.url]?.[0]
          if (transformDuration != null) {
            result.transformTime = transformDuration
          }
          try {
            const diagnostic = await ctx.experimental_getSourceModuleDiagnostic(moduleId, testModule)
            result.modules = diagnostic.modules
            result.untrackedModules = diagnostic.untrackedModules
          }
          catch {}
          return result
        },
        async getModuleGraph(project, id, browser): Promise<ModuleGraphData> {
          return getModuleGraph(ctx, project, id, browser)
        },
        async updateSnapshot(file?: File) {
          // silently ignore exec/write attempts if not allowed
          // this function both executes the code and write snapshots
          if (!ctx.config.api.allowExec || !ctx.config.api.allowWrite) {
            return
          }
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
        timeout: -1,
      },
    )

    clients.set(ws, rpc)

    ws.on('close', () => {
      clients.delete(ws)
      rpc.$close(new Error('[vitest-api]: Pending methods while closing rpc'))
    })
  }

  ctx.reporters.push(new WebSocketReporter(ctx, wss, clients))
}

export class WebSocketReporter implements Reporter {
  private start = 0
  private end = 0
  constructor(
    public ctx: Vitest,
    public wss: WebSocketServer,
    public clients: Map<WebSocket, WebSocketRPC>,
  ) {}

  onTestModuleCollected(testModule: TestModule): void {
    if (this.clients.size === 0) {
      return
    }

    this.clients.forEach((client) => {
      client.onCollected?.([testModule.task])?.catch?.(noop)
    })
  }

  onTestRunStart(specifications: ReadonlyArray<TestSpecification>): void {
    if (this.clients.size === 0) {
      return
    }

    this.start = performance.now()
    const serializedSpecs = specifications.map(spec => spec.toJSON())
    this.clients.forEach((client) => {
      client.onSpecsCollected?.(serializedSpecs)?.catch?.(noop)
    })
  }

  async onTestCaseAnnotate(testCase: TestCase, annotation: TestAnnotation): Promise<void> {
    if (this.clients.size === 0) {
      return
    }

    this.clients.forEach((client) => {
      client.onTestAnnotate?.(testCase.id, annotation)?.catch?.(noop)
    })
  }

  async onTestCaseArtifactRecord(testCase: TestCase, artifact: TestArtifact): Promise<void> {
    if (this.clients.size === 0) {
      return
    }

    this.clients.forEach((client) => {
      client.onTestArtifactRecord?.(testCase.id, artifact)?.catch?.(noop)
    })
  }

  async onTaskUpdate(packs: TaskResultPack[], events: TaskEventPack[]): Promise<void> {
    if (this.clients.size === 0) {
      return
    }

    this.clients.forEach((client) => {
      client.onTaskUpdate?.(packs, events)?.catch?.(noop)
    })
  }

  private sum<T>(items: T[], cb: (_next: T) => number | undefined) {
    return items.reduce((total, next) => {
      return total + Math.max(cb(next) || 0, 0)
    }, 0)
  }

  onTestRunEnd(testModules: ReadonlyArray<TestModule>, unhandledErrors: ReadonlyArray<SerializedError>): void {
    if (!this.clients.size) {
      return
    }

    const files = testModules.map(testModule => testModule.task)
    const errors = [...unhandledErrors]

    this.end = performance.now()
    const blobs = this.ctx.state.blobs
    // Execution time is either sum of all runs of `--merge-reports` or the current run's time
    const executionTime = blobs?.executionTimes ? this.sum(blobs.executionTimes, time => time) : this.end - this.start

    this.clients.forEach((client) => {
      client.onFinished?.(files, errors, undefined, executionTime)?.catch?.(noop)
    })
  }

  onFinishedReportCoverage(): void {
    this.clients.forEach((client) => {
      client.onFinishedReportCoverage?.()?.catch?.(noop)
    })
  }

  onUserConsoleLog(log: UserConsoleLog): void {
    this.clients.forEach((client) => {
      client.onUserConsoleLog?.(log)?.catch?.(noop)
    })
  }
}
