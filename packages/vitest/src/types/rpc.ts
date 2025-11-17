import type { CancelReason, File, TaskEventPack, TaskResultPack, TestAnnotation } from '@vitest/runner'
import type { SnapshotResult } from '@vitest/snapshot'
import type { FetchFunctionOptions, FetchResult } from 'vite/module-runner'
import type { OTELCarrier } from '../utils/traces'
import type { AfterSuiteRunMeta, FetchCachedFileSystemResult, ResolveFunctionResult, UserConsoleLog } from './general'

export interface RuntimeRPC {
  fetch: (
    id: string,
    importer: string | undefined,
    environment: string,
    options?: FetchFunctionOptions,
    otelCarrier?: OTELCarrier,
  ) => Promise<FetchResult | FetchCachedFileSystemResult>
  resolve: (id: string, importer: string | undefined, environment: string) => Promise<ResolveFunctionResult | null>
  transform: (id: string) => Promise<{ code?: string }>

  onUserConsoleLog: (log: UserConsoleLog) => void
  onUnhandledError: (err: unknown, type: string) => void
  onQueued: (file: File) => void
  onCollected: (files: File[]) => Promise<void>
  onAfterSuiteRun: (meta: AfterSuiteRunMeta) => void
  onTaskAnnotate: (testId: string, annotation: TestAnnotation) => Promise<TestAnnotation>
  onTaskUpdate: (pack: TaskResultPack[], events: TaskEventPack[]) => Promise<void>
  onCancel: (reason: CancelReason) => void
  getCountOfFailedTests: () => number

  snapshotSaved: (snapshot: SnapshotResult) => void
  resolveSnapshotPath: (testPath: string) => string
}

export interface RunnerRPC {
  onCancel: (reason: CancelReason) => void
}
