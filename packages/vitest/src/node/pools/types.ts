import type { ContextRPC } from '../../types/worker'
import type { TestProject } from '../project'

export interface PoolRunnerInitializer {
  readonly name: string
  createPoolWorker: (options: PoolOptions) => PoolWorker
}

export interface PoolOptions {
  distPath: string
  project: TestProject
  method: 'run' | 'collect'
  cacheFs?: boolean
  environment: string
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
   * - The task has the same project
   * - The task has the same environment
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
  context: ContextRPC
  memoryLimit: number | null
}

export type WorkerRequest
  = { __vitest_worker_request__: true } & (
    | { type: 'start'; options: { reportMemory: boolean } }
    | { type: 'stop' }
    | { type: 'run'; context: ContextRPC; poolId: number }
    | { type: 'collect'; context: ContextRPC; poolId: number }
    | { type: 'cancel' }
)

export type WorkerResponse
  = { __vitest_worker_response__: true } & (
    | { type: 'started' }
    | { type: 'stopped'; error?: unknown }
    | { type: 'testfileFinished'; usedMemory?: number; error?: unknown }
)
