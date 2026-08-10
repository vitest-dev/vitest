import type { Writable } from 'node:stream'
import type { PoolOptions, PoolWorker, WorkerRequest } from '../types'
import { resolve } from 'node:path'
import { Worker } from 'node:worker_threads'
import { streamFlushed } from './utils'

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

  on(event: string, callback: (...args: any[]) => void): void {
    this.thread.on(event, callback)
  }

  off(event: string, callback: (...args: any[]) => void): void {
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

    // `end: false`: the logger streams are shared by every worker, so one
    // ending worker stream must not end them for everyone else
    this.stdout.setMaxListeners(1 + this.stdout.getMaxListeners())
    this._thread.stdout.pipe(this.stdout, { end: false })

    this.stderr.setMaxListeners(1 + this.stderr.getMaxListeners())
    this._thread.stderr.pipe(this.stderr, { end: false })
  }

  async stop(): Promise<void> {
    const thread = this.thread
    // `terminate()` makes node drain the stdio still queued on the worker's
    // message port into these readables; keep the pipes attached until the
    // streams end so late output still reaches the logger streams
    const flushed = Promise.all([
      streamFlushed(thread.stdout),
      streamFlushed(thread.stderr),
    ])
    await thread.terminate()
    await flushed

    thread.stdout.unpipe(this.stdout)
    this.stdout.setMaxListeners(this.stdout.getMaxListeners() - 1)

    thread.stderr.unpipe(this.stderr)
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
