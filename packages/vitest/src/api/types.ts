import type { TransformResult } from 'vite'
import type { File, ModuleGraphData, Reporter, ResolvedConfig } from '../types'

export interface TransformResultWithSource extends TransformResult {
  source?: string
}

export interface WebSocketHandlers {
  getFiles(): File[]
  getConfig(): ResolvedConfig
  getModuleGraph(id: string): Promise<ModuleGraphData>
  getTransformResult(id: string): Promise<TransformResultWithSource | undefined>
  readFile(id: string): Promise<string>
  writeFile(id: string, content: string): Promise<void>
  rerun(files: string[]): Promise<void>
}

export interface WebSocketEvents extends Pick<Reporter, 'onCollected' | 'onTaskUpdate'> {
}
