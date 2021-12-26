import type { File } from '../types'

export interface WebSocketHandlers {
  getFiles(): File[]
}

export interface WebSocketEvents {
  onStart(files?: string[]): void
}
