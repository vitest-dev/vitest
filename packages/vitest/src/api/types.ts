import type { File, Reporter, ResolvedConfig } from '../types'

export interface WebSocketHandlers {
  getFiles(): File[]
  getConfig(): ResolvedConfig
  getSourceCode(id: string): Promise<string>
  rerun(files: string[]): Promise<void>
}

export interface WebSocketEvents extends Pick<Reporter, 'onCollected' | 'onTaskUpdate'> {
}
