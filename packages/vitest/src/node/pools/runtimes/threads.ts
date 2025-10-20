import type { PoolRuntime, WorkerRequest } from '../types'
import { resolve } from 'node:path'
import { Worker } from 'node:worker_threads'
import { BaseRuntime } from './base'

/** @experimental */
export class ThreadsRuntime extends BaseRuntime {
  name = 'threads'
  entrypoint: string
  private thread?: Worker

  constructor(options: PoolRuntime['options']) {
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

  async start(): Promise<void> {
    this.thread ||= new Worker(this.entrypoint, {
      env: this.options.env,
      execArgv: this.options.execArgv,
    })

    await super.start()
  }

  private stopPromise: Promise<void> | undefined

  async stop(): Promise<void> {
    await super.stop()
    this.stopPromise ??= this.thread?.terminate()
      ?.then(() => this.stopPromise = undefined)
    await this.stopPromise

    this.thread = undefined
  }
}
