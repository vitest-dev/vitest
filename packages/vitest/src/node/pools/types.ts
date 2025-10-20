import type { ContextRPC } from '../../types/worker'
import type { TestProject } from '../project'

export interface PoolRuntimeInitializer {
  runtime: string
  create: (options: PoolRuntimeOptions) => PoolRuntime
}

export interface PoolRuntimeOptions {
  distPath: string
  project: TestProject
  method: 'run' | 'collect'
  cacheFs?: boolean
  environment: string
  execArgv: string[]
  env: Record<string, string>
}

export interface PoolRuntime {
  name: string
  isStarted: boolean
  isTerminating: boolean
  reportMemory?: boolean

  /** Exposed to test runner as `VITEST_POOL_ID`. Value is between 1-`maxWorkers`. */
  poolId?: number

  options: PoolRuntimeOptions

  /** Note that start can be called multiple times. First time indicates worker warmup. */
  start: () => Promise<void>
  stop: () => Promise<void>
  on: ((event: 'message', callback: (message: WorkerResponse) => void) => void) & ((event: 'error', callback: (error: Error) => void) => void)
  off: ((event: 'message', callback: (message: WorkerResponse) => void) => void) & ((event: 'error', callback: (error: Error) => void) => void)
  onWorker: (event: string, callback: (arg: any) => void) => void
  offWorker: (event: string, callback: (arg: any) => void) => void
  postMessage: (message: WorkerRequest) => void
  serialize: (message: any) => any
  deserialize: (message: any) => any
}

export interface PoolTask {
  runtime: 'forks' | 'threads' | 'vmForks' | 'vmThreads' | (string & {})
  project: TestProject
  isolate: boolean
  env: Record<string, string>
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
