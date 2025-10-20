import type { BirpcReturn } from 'birpc'
import type { RunnerRPC, RuntimeRPC } from '../../../types/rpc'
import type { PoolRuntime, WorkerRequest, WorkerResponse } from '../types'
import { EventEmitter } from 'node:events'
import { createBirpc } from 'birpc'
import { createMethodsRPC } from '../rpc'

/** @experimental */
export class BaseRuntime implements PoolRuntime {
  name = 'base'
  reportMemory = false
  isTerminating = false
  isStarted = false
  options: PoolRuntime['options']
  poolId = undefined

  protected eventEmitter: EventEmitter<{
    message: [WorkerResponse]
    error: [Error]
    rpc: [unknown]
  }> = new EventEmitter()

  private rpc: BirpcReturn<RunnerRPC, RuntimeRPC>

  constructor(options: PoolRuntime['options']) {
    this.options = options

    this.rpc = createBirpc<RunnerRPC, RuntimeRPC>(
      createMethodsRPC(this.options.project, {
        collect: this.options.method === 'collect',
        cacheFs: this.options.cacheFs,
      }),
      {
        eventNames: ['onCancel'],
        post: request => this.postMessage(request),
        on: callback => this.eventEmitter.on('rpc', callback),
        timeout: -1,
      },
    )

    this.options.project.vitest.onCancel(reason => this.rpc.onCancel(reason))
  }

  postMessage(_: WorkerRequest): void {
    throw new Error('Expected to be implemented')
  }

  onWorker(_event: string, _callback: (arg: any) => void): void {
    throw new Error('Expected to be implemented')
  }

  offWorker(_event: string, _callback: (arg: any) => void): void {
    throw new Error('Expected to be implemented')
  }

  serialize<In, Out = In>(message: In): Out {
    return message as any
  }

  deserialize<In, Out = In>(message: In): Out {
    return message as any
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      return
    }

    this.isTerminating = false

    const isStarted = this.waitForStart()

    this.onWorker('error', this.emitWorkerError)
    this.onWorker('exit', this.emitUnexpectedExit)
    this.onWorker('message', this.emitWorkerMessage)

    this.postMessage({
      type: 'start',
      __vitest_worker_request__: true,
      options: {
        reportMemory: this.reportMemory,
      },
    })

    await isStarted
    this.isStarted = true
  }

  async stop(): Promise<void> {
    this.offWorker('exit', this.emitUnexpectedExit)

    await new Promise<void>((resolve) => {
      const onStop = (message: WorkerResponse) => {
        if (message.type === 'stopped') {
          if (message.error) {
            this.options.project.vitest.state.catchError(
              message.error,
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
    this.eventEmitter.removeAllListeners()
    this.rpc.$close(new Error('[vitest-pool-runtime]: Pending methods while closing rpc'))
  }

  on(event: 'message', callback: (message: WorkerResponse) => void): void
  on(event: 'error', callback: (error: Error) => void): void
  on(event: 'message' | 'error', callback: (arg: any) => void): void {
    this.eventEmitter.on(event, callback)
  }

  off(event: 'message', callback: (message: WorkerResponse) => void): void
  off(event: 'error', callback: (error: Error) => void): void
  off(event: 'message' | 'error', callback: (arg: any) => void): void {
    this.eventEmitter.off(event, callback)
  }

  private emitWorkerError(maybeError: unknown): void {
    const error = maybeError instanceof Error ? maybeError : new Error(String(maybeError))

    this.eventEmitter.emit('error', error)
  }

  private emitWorkerMessage = (response: WorkerResponse | { m: string; __vitest_worker_response__: false }): void => {
    try {
      const message = this.deserialize(response)

      if (message.__vitest_worker_response__) {
        this.eventEmitter.emit('message', message)
      }
      else {
        this.eventEmitter.emit('rpc', message)
      }
    }
    catch (error) {
      this.eventEmitter.emit('error', error as Error)
    }
  }

  private emitUnexpectedExit = (): void => {
    const error = new Error('Worker exited unexpectedly')

    this.eventEmitter.emit('error', error)
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
