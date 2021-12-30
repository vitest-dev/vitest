import type { File, Reporter, ResolvedConfig } from '../types'

export interface WebSocketHandlers {
  getFiles(): File[]
  getConfig(): ResolvedConfig
  getSourceCode(id: string): Promise<string>
  getModuleGraph(id: string): Promise<{graph: Record<string, string[]>; externalized: string[]; inlined: string[]}>
  rerun(files: string[]): Promise<void>
}

export interface WebSocketEvents extends Pick<Reporter, 'onCollected' | 'onTaskUpdate'> {
}
