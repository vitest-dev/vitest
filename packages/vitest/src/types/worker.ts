import type { ModuleCacheMap, ViteNodeResolveId } from 'vite-node'
import type { BirpcReturn } from 'birpc'
import type { CancelReason, Task } from '@vitest/runner'
import type { SerializedConfig } from '../runtime/config'
import type { RunnerRPC, RuntimeRPC } from './rpc'
import type { MockMap } from './mocker'
import type { TransformMode } from './general'
import type { Environment } from './environment'

/** @deprecated unused */
export type ResolveIdFunction = (
  id: string,
  importer?: string
) => Promise<ViteNodeResolveId | null>

export type WorkerRPC = BirpcReturn<RuntimeRPC, RunnerRPC>

export interface ContextTestEnvironment {
  name: string
  transformMode?: TransformMode
  options: Record<string, any> | null
}

export interface ContextRPC {
  pool: string
  worker: string
  workerId: number
  config: SerializedConfig
  projectName: string
  files: string[]
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
  moduleCache: ModuleCacheMap
  mockMap: MockMap
  providedContext: Record<string, any>
  durations: {
    environment: number
    prepare: number
  }
}
