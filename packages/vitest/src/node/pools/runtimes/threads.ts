import type { Runtime, WorkerRequest } from '../types'
import { resolve } from 'node:path'
import { Worker } from 'node:worker_threads'
import { BaseRuntime } from './base'

export class ThreadsRuntime extends BaseRuntime {
  name = 'threads'
  entrypoint: string
  private thread?: Worker

  constructor(options: Runtime['options']) {
    super(options)

    /** Loads {@link file://./../../../runtime/workers/threads.ts} */
    this.entrypoint = resolve(options.distPath, 'workers/threads.js')
  }

  onWorker(event: string, callback: (arg: any) => void): void {
    this.thread?.on(event, callback)
  }

  offWorker(event: string, callback: (arg: any) => void): void {
    this.thread?.off(event, callback)
  }

  postMessage(message: WorkerRequest): void {
    if (!this.isTerminating) {
      this.thread?.postMessage(message)
    }
  }

  async start(options: Parameters<Runtime['start']>[0]): Promise<void> {
    this.thread ||= new Worker(this.entrypoint, options)

    await super.start(options)
  }

  async stop(): Promise<void> {
    await super.stop()
    await this.thread?.terminate()

    this.thread = undefined
  }
}
