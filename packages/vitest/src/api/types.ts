import type { File, Reporter, ResolvedConfig } from '../types'

export interface WebSocketHandlers {
  getFiles(): File[]
  getConfig(): ResolvedConfig
  readFile(id: string): Promise<string>
  writeFile(id: string, content: string): Promise<void>
  getModuleGraph(id: string): Promise<{graph: Record<string, string[]>; externalized: string[]; inlined: string[]}>
  rerun(files: string[]): Promise<void>
}

export interface WebSocketEvents extends Pick<Reporter, 'onCollected' | 'onTaskUpdate'> {
}
