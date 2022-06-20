import type { MessagePort } from 'worker_threads'
import type { FetchFunction, ModuleCacheMap, RawSourceMap, ViteNodeResolveId } from 'vite-node'
import type { BirpcReturn } from 'birpc'
import type { MockMap } from './mocker'
import type { ResolvedConfig } from './config'
import type { File, TaskResultPack, Test } from './tasks'
import type { SnapshotResult } from './snapshot'
import type { UserConsoleLog } from './general'

export interface WorkerContext {
  workerId: number
  poolId: number
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

  onFinished: (files: File[], errors?: unknown[]) => void
  onWorkerExit: (code?: number) => void
  onUserConsoleLog: (log: UserConsoleLog) => void
  onUnhandledRejection: (err: unknown) => void
  onCollected: (files: File[]) => void
  onTaskUpdate: (pack: TaskResultPack[]) => void

  snapshotSaved: (snapshot: SnapshotResult) => void
  resolveSnapshotPath: (testPath: string) => string
}

export interface WorkerGlobalState {
  ctx: WorkerContext
  config: ResolvedConfig
  rpc: BirpcReturn<WorkerRPC>
  current?: Test
  filepath?: string
  moduleCache: ModuleCacheMap
  mockMap: MockMap
}
