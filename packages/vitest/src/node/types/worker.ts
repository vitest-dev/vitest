import type { MessagePort } from 'node:worker_threads'
import type { ContextRPC } from '../../types/worker'

export interface WorkerContext extends ContextRPC {
  port: MessagePort
}
