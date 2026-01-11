import type { CancelReason, FileSpecification, Task } from '@vitest/runner'
import type { BirpcReturn } from 'birpc'
import type { EvaluatedModules } from 'vite/module-runner'
import type { SerializedConfig } from '../runtime/config'
import type { Traces } from '../utils/traces'
import type { Environment } from './environment'
import type { RunnerRPC, RuntimeRPC } from './rpc'

export type WorkerRPC = BirpcReturn<RuntimeRPC, RunnerRPC>

export interface ContextTestEnvironment {
  name: string
  options: Record<string, any> | null
}

export interface WorkerTestEnvironment {
  name: string
  options: Record<string, any> | null
}

export type TestExecutionMethod = 'run' | 'collect'

export interface WorkerExecuteContext {
  files: FileSpecification[]
  providedContext: Record<string, any>
  invalidates?: string[]
  environment: ContextTestEnvironment

  /** Exposed to test runner as `VITEST_WORKER_ID`. Value is unique per each isolated worker. */
  workerId: number
}

export interface ContextRPC {
  pool: string
  config: SerializedConfig
  projectName: string
  environment: WorkerTestEnvironment
  rpc: WorkerRPC
  files: FileSpecification[]
  providedContext: Record<string, any>
  invalidates?: string[]

  /** Exposed to test runner as `VITEST_WORKER_ID`. Value is unique per each isolated worker. */
  workerId: number
}

export interface WorkerSetupContext {
  environment: WorkerTestEnvironment
  pool: string
  config: SerializedConfig
  projectName: string
  rpc: WorkerRPC
  /**
   * @internal
   */
  traces: Traces
}

export interface WorkerGlobalState {
  ctx: ContextRPC
  config: SerializedConfig
  rpc: WorkerRPC
  current?: Task
  filepath?: string
  metaEnv: {
    [key: string]: any
    BASE_URL: string
    MODE: string
    DEV: boolean
    PROD: boolean
    SSR: boolean
  }
  environment: Environment
  evaluatedModules: EvaluatedModules
  resolvingModules: Set<string>
  moduleExecutionInfo: Map<string, any>
  onCancel: (listener: (reason: CancelReason) => unknown) => void
  onCleanup: (listener: () => unknown) => void
  providedContext: Record<string, any>
  durations: {
    environment: number
    prepare: number
  }
  onFilterStackTrace?: (trace: string) => string
}
