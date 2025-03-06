import type { MessagePort } from 'node:worker_threads'
import type { ModuleCacheMap, ModuleExecutionInfo } from 'vite-node'
import type { ContextRPC } from '../../types/worker'

export interface WorkerContext extends ContextRPC {
  port: MessagePort
}

declare module 'vitest' {
  interface WorkerGlobalState {
    moduleCache: ModuleCacheMap
    moduleExecutionInfo?: ModuleExecutionInfo
  }
}
