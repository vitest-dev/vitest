import type { Context, Span } from '@opentelemetry/api'
import type { ContextTestEnvironment, WorkerExecuteContext, WorkerTestEnvironment } from '../../types/worker'
import type { OTELCarrier } from '../../utils/traces'
import type { TestProject } from '../project'
import type { SerializedConfig } from '../types/config'

export interface PoolRunnerInitializer {
  readonly name: string
  createPoolWorker: (options: PoolOptions) => PoolWorker
}

export interface PoolOptions {
  distPath: string
  project: TestProject
  method: 'run' | 'collect'
  cacheFs?: boolean
  environment: ContextTestEnvironment
  execArgv: string[]
  env: Partial<NodeJS.ProcessEnv>
}

export interface PoolWorker {
  readonly name: string
  readonly reportMemory?: boolean
  readonly cacheFs?: boolean

  on: (event: string, callback: (arg: any) => void) => void
  off: (event: string, callback: (arg: any) => void) => void
  send: (message: WorkerRequest) => void
  deserialize: (data: unknown) => unknown

  start: () => Promise<void>
  stop: () => Promise<void>

  /**
   * This is called on workers that already satisfy certain constraints:
   * - The task has the same worker name
   * - The task has the same project
   */
  canReuse?: (task: PoolTask) => boolean
}

export interface PoolTask {
  worker: 'forks' | 'threads' | 'vmForks' | 'vmThreads' | (string & {})
  project: TestProject
  isolate: boolean
  /**
   * Custom `process.env`. All tasks in the same project will reference the same object,
   * so modifying it once will modify it for every task.
   */
  env: Partial<NodeJS.ProcessEnv>
  /**
   * Custom `execArgv`. All tasks in the same project will reference the same array,
   * so modifying it once will modify it for every task.
   */
  execArgv: string[]
  context: WorkerExecuteContext
  memoryLimit: number | null
}

export interface PoolRunnerOTEL {
  span: Span
  workerContext: Context
  currentContext?: Context
  files: string[]
}

export type WorkerRequest
  = { __vitest_worker_request__: true } & (
    | {
      type: 'start'
      poolId: number
      workerId: WorkerExecuteContext['workerId'] // Initial worker ID, may change when non-isolated worker runs multiple test files
      options: { reportMemory: boolean }
      context: {
        environment: WorkerTestEnvironment
        config: SerializedConfig
        pool: string
      }
      traces: {
        enabled: boolean
        sdkPath?: string
        otelCarrier?: OTELCarrier
      }
    }
    | {
      type: 'stop'
      otelCarrier?: OTELCarrier
    }
    | {
      type: 'run'
      context: WorkerExecuteContext
      otelCarrier?: OTELCarrier
    }
    | {
      type: 'collect'
      context: WorkerExecuteContext
      otelCarrier?: OTELCarrier
    }
    | { type: 'cancel' }
)

export type WorkerResponse
  = { __vitest_worker_response__: true } & (
    | { type: 'started'; error?: unknown }
    | { type: 'stopped'; error?: unknown }
    | { type: 'testfileFinished'; usedMemory?: number; error?: unknown }
)
