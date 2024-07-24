import type { FetchResult, RawSourceMap, ViteNodeResolveId } from 'vite-node'
import type { CancelReason, File, TaskResultPack } from '@vitest/runner'
import type { SnapshotResult } from '@vitest/snapshot'
import type { AfterSuiteRunMeta, TransformMode, UserConsoleLog } from './general'

export interface RuntimeRPC {
  fetch: (
    id: string,
    transformMode: TransformMode
  ) => Promise<{
    externalize?: string
    id?: string
  }>
  transform: (id: string, transformMode: TransformMode) => Promise<FetchResult>
  resolveId: (
    id: string,
    importer: string | undefined,
    transformMode: TransformMode
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
