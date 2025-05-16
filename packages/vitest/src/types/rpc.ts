import type { CancelReason, File, TaskEventPack, TaskResultPack } from '@vitest/runner'
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
  transform: (id: string, transformMode: TransformMode) => Promise<{
    code?: string
  }>
  resolveId: (
    id: string,
    importer: string | undefined,
    transformMode: TransformMode
  ) => Promise<{
    external?: boolean | 'absolute' | 'relative'
    id: string
    /** @deprecated */
    meta?: Record<string, any> | null
    /** @deprecated */
    moduleSideEffects?: boolean | 'no-treeshake' | null
    /** @deprecated */
    syntheticNamedExports?: boolean | string | null
  } | null>
  /**
   * @deprecated unused
   */
  getSourceMap: (
    id: string,
    force?: boolean
  ) => Promise<any>

  onUserConsoleLog: (log: UserConsoleLog) => void
  onUnhandledError: (err: unknown, type: string) => void
  onQueued: (file: File) => void
  onCollected: (files: File[]) => Promise<void>
  onAfterSuiteRun: (meta: AfterSuiteRunMeta) => void
  onTaskUpdate: (pack: TaskResultPack[], events: TaskEventPack[]) => Promise<void>
  onCancel: (reason: CancelReason) => void
  getCountOfFailedTests: () => number

  snapshotSaved: (snapshot: SnapshotResult) => void
  resolveSnapshotPath: (testPath: string) => string
}

export interface RunnerRPC {
  onCancel: (reason: CancelReason) => void
}
