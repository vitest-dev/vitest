import type { FetchResult, RawSourceMap, ViteNodeResolveId } from 'vite-node'
import type { CancelReason } from '@vitest/runner'
import type {
  EnvironmentOptions,
  Pool,
  ResolvedConfig,
  VitestEnvironment,
} from './config'
import type { Environment, UserConsoleLog } from './general'
import type { SnapshotResult } from './snapshot'
import type { File, TaskResultPack } from './tasks'
import type { AfterSuiteRunMeta } from './worker'

type TransformMode = 'web' | 'ssr'

export interface RuntimeRPC {
  fetch: (
    id: string,
    environment: TransformMode
  ) => Promise<{
    externalize?: string
    id?: string
  }>
  transform: (id: string, environment: TransformMode) => Promise<FetchResult>
  resolveId: (
    id: string,
    importer: string | undefined,
    environment: TransformMode
  ) => Promise<ViteNodeResolveId | null>
  getSourceMap: (
    id: string,
    force?: boolean
  ) => Promise<RawSourceMap | undefined>

  onFinished: (files: File[], errors?: unknown[]) => void
  onPathsCollected: (paths: string[]) => void
  onUserConsoleLog: (log: UserConsoleLog) => void
  onUnhandledError: (err: unknown, type: string) => void
  onCollected: (files: File[]) => Promise<void>
  onAfterSuiteRun: (meta: AfterSuiteRunMeta) => void
  onTaskUpdate: (pack: TaskResultPack[]) => Promise<void>
  onCancel: (reason: CancelReason) => void
  getCountOfFailedTests: () => number

  snapshotSaved: (snapshot: SnapshotResult) => void
  resolveSnapshotPath: (testPath: string) => string
}

export interface RunnerRPC {
  onCancel: (reason: CancelReason) => void
}

export interface ContextTestEnvironment {
  name: VitestEnvironment
  transformMode?: TransformMode
  options: EnvironmentOptions | null
}

export interface ResolvedTestEnvironment {
  environment: Environment
  options: EnvironmentOptions | null
}

export interface ContextRPC {
  pool: Pool
  worker: string
  workerId: number
  config: ResolvedConfig
  projectName: string
  files: string[]
  environment: ContextTestEnvironment
  providedContext: Record<string, any>
  invalidates?: string[]
}
