import type { RawSourceMap } from 'source-map'
import type { FetchResult, ViteNodeResolveId } from 'vite-node'
import type { EnvironmentOptions, ResolvedConfig, VitestEnvironment } from './config'
import type { UserConsoleLog } from './general'
import type { SnapshotResult } from './snapshot'
import type { File, TaskResultPack } from './tasks'
import type { AfterSuiteRunMeta } from './worker'

export interface RuntimeRPC {
  fetch: (id: string, environment: VitestEnvironment) => Promise<FetchResult>
  resolveId: (id: string, importer: string | undefined, environment: VitestEnvironment) => Promise<ViteNodeResolveId | null>
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

export interface ContextTestEnvironment {
  name: VitestEnvironment
  options: EnvironmentOptions | null
}

export interface ContextRPC {
  config: ResolvedConfig
  files: string[]
  invalidates?: string[]
  environment: ContextTestEnvironment
}
