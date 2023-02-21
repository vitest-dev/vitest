import type { MessagePort } from 'node:worker_threads'
import type { File, TaskResultPack, Test } from '@vitest/runner'
import type { FetchFunction, ModuleCacheMap, RawSourceMap, ViteNodeResolveId } from 'vite-node'
import type { BirpcReturn } from 'birpc'
import type { MockMap } from './mocker'
import type { EnvironmentOptions, ResolvedConfig, VitestEnvironment } from './config'
import type { SnapshotResult } from './snapshot'
import type { UserConsoleLog } from './general'

export interface WorkerTestEnvironment {
  name: VitestEnvironment
  options: EnvironmentOptions | null
}

export interface WorkerContext {
  workerId: number
  port: MessagePort
  config: ResolvedConfig
  files: string[]
  environment: WorkerTestEnvironment
  invalidates?: string[]
}

export type ResolveIdFunction = (id: string, importer?: string) => Promise<ViteNodeResolveId | null>

export interface AfterSuiteRunMeta {
  coverage?: unknown
}

export interface WorkerRPC {
  fetch: FetchFunction
  resolveId: ResolveIdFunction
  getSourceMap: (id: string, force?: boolean) => Promise<RawSourceMap | undefined>

  onFinished: (files: File[], errors?: unknown[]) => void
  onWorkerExit: (error: unknown, code?: number) => void
  onPathsCollected: (paths: string[]) => void
  onUserConsoleLog: (log: UserConsoleLog) => void
  onUnhandledError: (err: unknown, type: string) => void
  onCollected: (files: File[]) => void
  onAfterSuiteRun: (meta: AfterSuiteRunMeta) => void
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
