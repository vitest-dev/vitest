import type { File, Reporter } from '../types'

export interface WebSocketHandlers {
  getFiles(): File[]
}

export interface WebSocketEvents extends Pick<Reporter, 'onCollected' | 'onTaskUpdate'> {
}
