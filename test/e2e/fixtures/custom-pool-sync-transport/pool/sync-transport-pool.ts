import type { PoolOptions, PoolRunnerInitializer, PoolWorker, WorkerRequest } from 'vitest/node'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'

/**
 * A pool whose runtime registers its message listener only after the first
 * message has already arrived, and flushes what it buffered synchronously from
 * inside the registration call. Real pools with a synchronous transport (an IPC
 * bridge that replays a queue on connect) behave this way.
 */
export function createSyncTransportPool(): PoolRunnerInitializer {
  return {
    name: 'sync-transport',
    createPoolWorker: options => new SyncTransportPoolWorker(options),
  }
}

/** Loads {@link file://./runtime.js} */
const entrypoint = fileURLToPath(new URL('./runtime.js', import.meta.url))

class SyncTransportPoolWorker implements PoolWorker {
  public readonly name = 'sync-transport'

  private execArgv: string[]
  private env: Partial<NodeJS.ProcessEnv>
  private _thread: Worker | undefined

  constructor(options: PoolOptions) {
    this.execArgv = options.execArgv
    this.env = options.env
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

  deserialize(data: unknown): unknown {
    return data
  }

  async start(): Promise<void> {
    this._thread ||= new Worker(entrypoint, {
      env: this.env,
      execArgv: this.execArgv,
    })
  }

  async stop(): Promise<void> {
    await this.thread.terminate()
    this._thread = undefined
  }

  private get thread(): Worker {
    if (!this._thread) {
      throw new Error('The worker thread was torn down or never initialized.')
    }
    return this._thread
  }
}
