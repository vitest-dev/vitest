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
  env: Record<string, string>
}

export interface PoolWorker {
  readonly name: string
  readonly execArgv: string[]
  readonly env: Record<string, string>
  readonly reportMemory?: boolean
  readonly cacheFs?: boolean

  on: (event: string, callback: (arg: any) => void) => void
  off: (event: string, callback: (arg: any) => void) => void
  send: (message: WorkerRequest) => void
  deserialize: (data: unknown) => unknown

  start: () => Promise<void>
  stop: () => Promise<void>
}

export interface PoolTask {
  worker: 'forks' | 'threads' | 'vmForks' | 'vmThreads' | (string & {})
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
