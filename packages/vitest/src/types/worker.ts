import type { MessagePort } from 'worker_threads'
import type { FetchFunction, ModuleCache, RawSourceMap, ViteNodeResolveId } from 'vite-node'
import type { BirpcReturn } from 'birpc'
import type { ResolvedConfig } from './config'
import type { File, TaskResultPack, Test } from './tasks'
import type { SnapshotResult } from './snapshot'
import type { UserConsoleLog } from './general'

export interface WorkerContext {
  id: number
  port: MessagePort
  config: ResolvedConfig
  files: string[]
  invalidates?: string[]
}

export type ResolveIdFunction = (id: string, importer?: string) => Promise<ViteNodeResolveId | null>

export interface WorkerRPC {
  fetch: FetchFunction
  resolveId: ResolveIdFunction
  getSourceMap: (id: string, force?: boolean) => Promise<RawSourceMap | undefined>

  onFinished: (files: File[]) => void
  onWorkerExit: (code?: number) => void
  onUserConsoleLog: (log: UserConsoleLog) => void
  onCollected: (files: File[]) => void
  onTaskUpdate: (pack: TaskResultPack[]) => void

  snapshotSaved: (snapshot: SnapshotResult) => void
}

export interface WorkerGlobalState {
  ctx: WorkerContext
  config: ResolvedConfig
  rpc: BirpcReturn<WorkerRPC>
  current?: Test
  filepath?: string
  moduleCache: Map<string, ModuleCache>
}
