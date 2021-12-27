import type { File, Reporter } from '../types'

export interface WebSocketHandlers {
  getFiles(): File[]
  getSourceCode(id: string): Promise<string>
}

export interface WebSocketEvents extends Pick<Reporter, 'onCollected' | 'onTaskUpdate'> {
}
