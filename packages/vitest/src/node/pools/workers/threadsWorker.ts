import type { Writable } from 'node:stream'
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
  private stdout: NodeJS.WriteStream | Writable
  private stderr: NodeJS.WriteStream | Writable

  constructor(options: PoolOptions) {
    this.execArgv = options.execArgv
    this.env = options.env
    this.stdout = options.project.vitest.logger.outputStream
    this.stderr = options.project.vitest.logger.errorStream

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
      stdout: true,
      stderr: true,
    })

    this.stdout.setMaxListeners(1 + this.stdout.getMaxListeners())
    this._thread.stdout.pipe(this.stdout)

    this.stderr.setMaxListeners(1 + this.stderr.getMaxListeners())
    this._thread.stderr.pipe(this.stderr)
  }

  async stop(): Promise<void> {
    await this.thread.terminate()

    this._thread?.stdout?.unpipe(this.stdout)
    this.stdout.setMaxListeners(this.stdout.getMaxListeners() - 1)

    this._thread?.stderr?.unpipe(this.stderr)
    this.stderr.setMaxListeners(this.stderr.getMaxListeners() - 1)

    this._thread = undefined
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
