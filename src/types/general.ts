import { Awaitable } from '@antfu/utils'
import { TransformResult, ViteDevServer } from 'vite'
import { StateManager } from '../node/state'
import { SnapshotManager } from '../integrations/snapshot/manager'
import { ResolvedConfig } from './options'
import { Reporter } from './reporter'

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
  reporter: Reporter
}
