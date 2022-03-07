import type { TransformResult } from 'vite'
import type { File, ModuleGraphData, Reporter, ResolvedConfig, Task, TaskResultPack } from '../types'

export interface TransformResultWithSource extends TransformResult {
  source?: string
}

export interface WebSocketHandlers {
  onWatcherStart: () => Promise<void>
  onFinished(files?: File[]): Promise<void>
  // onPathsCollected(paths?: string[]): Promise<void>
  onCollected(files?: File[]): Promise<void>
  onTaskUpdate(packs: TaskResultPack[]): void
  getFiles(): File[]
  getPaths(): string[]
  getConfig(): ResolvedConfig
  getModuleGraph(id: string): Promise<ModuleGraphData>
  getTransformResult(id: string): Promise<TransformResultWithSource | undefined>
  readFile(id: string): Promise<string>
  writeFile(id: string, content: string): Promise<void>
  rerun(files: string[]): Promise<void>
  updateSnapshot(file?: File): Promise<void>
}

export interface WebSocketEvents extends Pick<Reporter, 'onCollected' | 'onFinished' | 'onTaskUpdate' | 'onUserConsoleLog' | 'onPathsCollected'> {
}
