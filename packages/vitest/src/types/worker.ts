import type { MessagePort } from 'node:worker_threads'
import type { Test } from '@vitest/runner'
import type { ModuleCacheMap, ViteNodeResolveId } from 'vite-node'
import type { BirpcReturn } from 'birpc'
import type { MockMap } from './mocker'
import type { ResolvedConfig } from './config'
import type { ContextRPC, RuntimeRPC } from './rpc'

export interface WorkerContext extends ContextRPC {
  workerId: number
  port: MessagePort
}

export type ResolveIdFunction = (id: string, importer?: string) => Promise<ViteNodeResolveId | null>

export interface AfterSuiteRunMeta {
  coverage?: unknown
}

export interface WorkerGlobalState {
  ctx: WorkerContext
  config: ResolvedConfig
  rpc: BirpcReturn<RuntimeRPC>
  current?: Test
  filepath?: string
  moduleCache: ModuleCacheMap
  mockMap: MockMap
}
