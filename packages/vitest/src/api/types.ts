import type { TransformResult } from 'vite'
import type { AfterSuiteRunMeta, File, ModuleGraphData, Reporter, ResolvedConfig, SnapshotResult, TaskResultPack, UserConsoleLog } from '../types'

export interface TransformResultWithSource extends TransformResult {
  source?: string
}

export interface WebSocketHandlers {
  onCollected(files?: File[]): Promise<void>
  onTaskUpdate(packs: TaskResultPack[]): void
  onAfterSuiteRun(meta: AfterSuiteRunMeta): void
  onDone(name: string): void
  sendLog(log: UserConsoleLog): void
  getFiles(): File[]
  getPaths(): string[]
  getConfig(): ResolvedConfig
  resolveSnapshotPath(testPath: string): string
  resolveSnapshotRawPath(testPath: string, rawPath: string): string
  getModuleGraph(id: string): Promise<ModuleGraphData>
  getTransformResult(id: string): Promise<TransformResultWithSource | undefined>
  readFile(id: string): Promise<string | null>
  writeFile(id: string, content: string, ensureDir?: boolean): Promise<void>
  removeFile(id: string): Promise<void>
  createDirectory(id: string): Promise<string | undefined>
  snapshotSaved(snapshot: SnapshotResult): void
  rerun(files: string[]): Promise<void>
  updateSnapshot(file?: File): Promise<void>
}

export interface WebSocketEvents extends Pick<Reporter, 'onCollected' | 'onFinished' | 'onTaskUpdate' | 'onUserConsoleLog' | 'onPathsCollected'> {
}
