import { MessagePort } from 'worker_threads'

export interface WorkerContext {
  port: MessagePort
  file: string
}

export interface WorkerMessage {
  type: 'request'
  path: string
  code?: string
  error?: Error
}
