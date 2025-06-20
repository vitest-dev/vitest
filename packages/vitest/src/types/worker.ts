import type { CancelReason, FileSpecification, Task } from '@vitest/runner'
import type { BirpcReturn } from 'birpc'
import type { SerializedConfig } from '../runtime/config'
import type { Environment } from './environment'
import type { TransformMode } from './general'
import type { RunnerRPC, RuntimeRPC } from './rpc'

export type WorkerRPC = BirpcReturn<RuntimeRPC, RunnerRPC>

export interface ContextTestEnvironment {
  name: string
  transformMode?: TransformMode
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
  environment: Environment
  environmentTeardownRun?: boolean
  onCancel: Promise<CancelReason>
  moduleCache: Map<string, any>
  moduleExecutionInfo: Map<string, any>
  onCleanup: (listener: () => unknown) => void
  providedContext: Record<string, any>
  durations: {
    environment: number
    prepare: number
  }
  onFilterStackTrace?: (trace: string) => string
}
