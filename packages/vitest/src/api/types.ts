import type { TransformResult } from 'vite'
import type { CancelReason } from '@vitest/runner'
import type { AfterSuiteRunMeta, File, ModuleGraphData, ProvidedContext, Reporter, ResolvedConfig, SnapshotResult, TaskResultPack, UserConsoleLog } from '../types'

export interface TransformResultWithSource extends TransformResult {
  source?: string
}

export interface WebSocketHandlers {
  onUnhandledError(error: unknown, type: string): Promise<void>
  onCollected(files?: File[]): Promise<void>
  onTaskUpdate(packs: TaskResultPack[]): void
  onAfterSuiteRun(meta: AfterSuiteRunMeta): void
  onDone(name: string): void
  onCancel(reason: CancelReason): void
  getCountOfFailedTests(): number
  sendLog(log: UserConsoleLog): void
  getFiles(): File[]
  getPaths(): string[]
  getConfig(): ResolvedConfig
  resolveSnapshotPath(testPath: string): string
  resolveSnapshotRawPath(testPath: string, rawPath: string): string
  getModuleGraph(id: string): Promise<ModuleGraphData>
  getTransformResult(id: string): Promise<TransformResultWithSource | undefined>
  readSnapshotFile(id: string): Promise<string | null>
  readTestFile(id: string): Promise<string | null>
  saveTestFile(id: string, content: string): Promise<void>
  saveSnapshotFile(id: string, content: string): Promise<void>
  removeSnapshotFile(id: string): Promise<void>
  snapshotSaved(snapshot: SnapshotResult): void
  rerun(files: string[]): Promise<void>
  updateSnapshot(file?: File): Promise<void>
  getProvidedContext(): ProvidedContext
}

export interface WebSocketEvents extends Pick<Reporter, 'onCollected' | 'onFinished' | 'onTaskUpdate' | 'onUserConsoleLog' | 'onPathsCollected'> {
  onCancel(reason: CancelReason): void
}
