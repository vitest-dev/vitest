import type { BirpcReturn } from 'birpc'
import type { RunnerRPC, RuntimeRPC } from '../../types/rpc'
import type { TestProject } from '../project'
import type { PoolOptions, PoolWorker, WorkerRequest, WorkerResponse } from './types'
import { EventEmitter } from 'node:events'
import { createBirpc } from 'birpc'
import { createMethodsRPC } from './rpc'

/** @experimental */
export class PoolRunner {
  public isTerminating = false
  public isStarted = false
  /** Exposed to test runner as `VITEST_POOL_ID`. Value is between 1-`maxWorkers`. */
  public poolId: number | undefined = undefined

  public readonly project: TestProject
  public readonly environment: string

  private _eventEmitter: EventEmitter<{
    message: [WorkerResponse]
    error: [Error]
    rpc: [unknown]
  }> = new EventEmitter()

  private _rpc: BirpcReturn<RunnerRPC, RuntimeRPC>

  constructor(options: PoolOptions, public worker: PoolWorker) {
    this.project = options.project
    this.environment = options.environment
    this._rpc = createBirpc<RunnerRPC, RuntimeRPC>(
      createMethodsRPC(this.project, {
        collect: options.method === 'collect',
        cacheFs: worker.cacheFs,
      }),
      {
        eventNames: ['onCancel'],
        post: request => this.postMessage(request),
        on: callback => this._eventEmitter.on('rpc', callback),
        timeout: -1,
      },
    )

    this.project.vitest.onCancel(reason => this._rpc.onCancel(reason))
  }

  postMessage(message: WorkerRequest): void {
    if (!this.isTerminating) {
      return this.worker.send(message)
    }
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      return
    }

    await this.worker.start()

    this.isTerminating = false

    const isStarted = this.waitForStart()

    this.worker.on('error', this.emitWorkerError)
    this.worker.on('exit', this.emitUnexpectedExit)
    this.worker.on('message', this.emitWorkerMessage)

    this.postMessage({
      type: 'start',
      __vitest_worker_request__: true,
      options: {
        reportMemory: this.worker.reportMemory ?? false,
      },
    })

    await isStarted
    this.isStarted = true
  }

  async stop(): Promise<void> {
    this.worker.off('exit', this.emitUnexpectedExit)

    await new Promise<void>((resolve) => {
      const onStop = (response: WorkerResponse) => {
        if (response.type === 'stopped') {
          if (response.error) {
            this.project.vitest.state.catchError(
              response.error,
              'Teardown Error',
            )
          }

          resolve()
          this.off('message', onStop)
        }
      }

      this.on('message', onStop)
      this.postMessage({ type: 'stop', __vitest_worker_request__: true })
    })

    this.isStarted = false
    this.isTerminating = true
    this._eventEmitter.removeAllListeners()
    this._rpc.$close(new Error('[vitest-pool-runner]: Pending methods while closing rpc'))

    await this.worker.stop()
  }

  on(event: 'message', callback: (message: WorkerResponse) => void): void
  on(event: 'error', callback: (error: Error) => void): void
  on(event: 'message' | 'error', callback: (arg: any) => void): void {
    this._eventEmitter.on(event, callback)
  }

  off(event: 'message', callback: (message: WorkerResponse) => void): void
  off(event: 'error', callback: (error: Error) => void): void
  off(event: 'message' | 'error', callback: (arg: any) => void): void {
    this._eventEmitter.off(event, callback)
  }

  private emitWorkerError(maybeError: unknown): void {
    const error = maybeError instanceof Error ? maybeError : new Error(String(maybeError))

    this._eventEmitter.emit('error', error)
  }

  private emitWorkerMessage = (response: WorkerResponse | { m: string; __vitest_worker_response__: false }): void => {
    try {
      const message = this.worker.deserialize(response) as WorkerResponse

      if (typeof message === 'object' && message != null && message.__vitest_worker_response__) {
        this._eventEmitter.emit('message', message)
      }
      else {
        this._eventEmitter.emit('rpc', message)
      }
    }
    catch (error) {
      this._eventEmitter.emit('error', error as Error)
    }
  }

  private emitUnexpectedExit = (): void => {
    const error = new Error('Worker exited unexpectedly')

    this._eventEmitter.emit('error', error)
  }

  private waitForStart() {
    return new Promise<void>((resolve) => {
      const onStart = (message: WorkerResponse) => {
        if (message.type === 'started') {
          this.off('message', onStart)
          resolve()
        }
      }

      this.on('message', onStart)
    })
  }
}
