import type { TransformResult, ViteDevServer } from 'vite'
import type { StateManager } from '../node/state'
import type { SnapshotManager } from '../integrations/snapshot/manager'
import type { ResolvedConfig } from './options'
import type { Reporter } from './reporter'

export type Awaitable<T> = T | PromiseLike<T>
export type Nullable<T> = T | null | undefined
export type Arrayable<T> = T | Array<T>

export interface ModuleCache {
  promise?: Promise<any>
  exports?: any
  transformResult?: TransformResult
}

export interface EnvironmentReturn {
  teardown: (global: any) => Awaitable<void>
}

export interface Environment {
  name: string
  setup(global: any): Awaitable<EnvironmentReturn>
}

export interface VitestContext {
  config: ResolvedConfig
  server: ViteDevServer
  state: StateManager
  snapshot: SnapshotManager
  reporters: Reporter[]
  console: Console
}

export interface UserConsoleLog {
  content: string
  type: 'stdout' | 'stderr'
  taskId?: string
}
