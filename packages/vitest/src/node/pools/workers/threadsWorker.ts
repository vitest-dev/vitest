import type { PoolOptions, PoolWorker, WorkerRequest } from '../types'
import { resolve } from 'node:path'
import { Worker } from 'node:worker_threads'

/** @experimental */
export class ThreadsPoolWorker implements PoolWorker {
  public readonly name: string = 'threads'

  protected readonly entrypoint: string
  protected execArgv: string[]
  protected env: Partial<NodeJS.ProcessEnv>

  private _thread?: Worker

  constructor(options: PoolOptions) {
    this.execArgv = options.execArgv
    this.env = options.env
    /** Loads {@link file://./../../../runtime/workers/threads.ts} */
    this.entrypoint = resolve(options.distPath, 'workers/threads.js')
  }

  on(event: string, callback: (arg: any) => void): void {
    this.thread.on(event, callback)
  }

  off(event: string, callback: (arg: any) => void): void {
    this.thread.off(event, callback)
  }

  send(message: WorkerRequest): void {
    this.thread.postMessage(message)
  }

  async start(): Promise<void> {
    // This can be called multiple times if the runtime is shared.
    this._thread ||= new Worker(this.entrypoint, {
      env: this.env,
      execArgv: this.execArgv,
    })
  }

  async stop(): Promise<void> {
    await this.thread.terminate().then(() => {
      this._thread = undefined
    })
  }

  deserialize(data: unknown): unknown {
    return data
  }

  private get thread() {
    if (!this._thread) {
      throw new Error(`The worker thread was torn down or never initialized. This is a bug in Vitest.`)
    }
    return this._thread
  }
}
