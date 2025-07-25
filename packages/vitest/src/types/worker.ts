import type { CancelReason, FileSpecification, Task } from '@vitest/runner'
import type { BirpcReturn } from 'birpc'
import type { EvaluatedModules } from 'vite/module-runner'
import type { SerializedConfig } from '../runtime/config'
import type { Environment } from './environment'
import type { RunnerRPC, RuntimeRPC } from './rpc'

export type WorkerRPC = BirpcReturn<RuntimeRPC, RunnerRPC>

export interface ContextTestEnvironment {
  name: string
  options: Record<string, any> | null
}

export type TestExecutionMethod = 'run' | 'collect'

export interface ContextRPC {
  pool: string
  worker: string
  workerId: number
  config: SerializedConfig
  projectName: string
  files: string[] | FileSpecification[]
  environment: ContextTestEnvironment
  providedContext: Record<string, any>
  invalidates?: string[]
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
  environmentTeardownRun?: boolean
  onCancel: Promise<CancelReason>
  evaluatedModules: EvaluatedModules
  resolvingModules: Set<string>
  moduleExecutionInfo: Map<string, any>
  onCleanup: (listener: () => unknown) => void
  providedContext: Record<string, any>
  durations: {
    environment: number
    prepare: number
  }
  onFilterStackTrace?: (trace: string) => string
}
