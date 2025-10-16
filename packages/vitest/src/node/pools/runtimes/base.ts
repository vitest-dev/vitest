import type { BirpcReturn } from 'birpc'
import type { RunnerRPC, RuntimeRPC } from '../../../types/rpc'
import type { PoolRuntime, WorkerRequest, WorkerResponse } from '../types'
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

  private rpc: BirpcReturn<RunnerRPC, RuntimeRPC>
  private rpcListeners: ((message: unknown) => void)[] = []
  private onMessageListeners: ((message: WorkerResponse) => void)[] = []
  private onErrorListeners: ((error: Error) => void)[] = []

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
        on: callback => this.rpcListeners.push(callback),
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

  async start(_: Parameters<PoolRuntime['start']>[0]): Promise<void> {
    if (this.isStarted) {
      return
    }

    this.isTerminating = false

    const isStarted = this.waitForStart()

    this.onWorker('error', this.onWorkerError)
    this.onWorker('exit', this.onUnexpectedExit)
    this.onWorker('message', this.onWorkerMessage)

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
    if (this.isTerminating) {
      return
    }

    this.offWorker('exit', this.onUnexpectedExit)

    await new Promise<void>((resolve) => {
      const onStop = (message: WorkerResponse) => {
        if (message.type === 'stopped') {
          resolve()
          this.off('message', onStop)
        }
      }

      this.on('message', onStop)
      this.postMessage({ type: 'stop', __vitest_worker_request__: true })
    })

    this.isStarted = false
    this.isTerminating = true
    this.onMessageListeners = []
    this.onErrorListeners = []
    this.rpc.$close(new Error('[vitest-pool-runtime]: Pending methods while closing rpc'))
  }

  on(event: 'message', callback: (message: WorkerResponse) => void): void
  on(event: 'error', callback: (error: Error) => void): void
  on(event: string, callback: (arg: any) => void): void {
    if (event === 'message') {
      this.onMessageListeners.push(callback)
    }
    else if (event === 'error') {
      this.onErrorListeners.push(callback)
    }
  }

  off(event: 'message', callback: (message: WorkerResponse) => void): void
  off(event: 'error', callback: (error: Error) => void): void
  off(event: string, callback: (arg: any) => void): void {
    let listeners

    if (event === 'message') {
      listeners = this.onMessageListeners
    }
    else if (event === 'error') {
      listeners = this.onErrorListeners
    }

    const index = listeners?.indexOf(callback) ?? -1

    if (index !== -1) {
      listeners?.splice(index, 1)
    }
  }

  private onWorkerError(maybeError: unknown): void {
    const error = maybeError instanceof Error ? maybeError : new Error(String(maybeError))

    this.onErrorListeners.forEach(callback => callback(error))
  }

  private onWorkerMessage = (response: WorkerResponse | { m: string; __vitest_worker_response__: false }): void => {
    try {
      const message = this.deserialize(response)

      if (message.__vitest_worker_response__) {
        this.onMessageListeners.forEach(callback => callback(message))
      }
      else {
        this.rpcListeners.forEach(callback => callback(message))
      }
    }
    catch (error) {
      this.onErrorListeners.forEach(callback => callback(error as Error))
    }
  }

  private onUnexpectedExit = (): void => {
    const error = new Error('Worker exited unexpectedly')

    this.onErrorListeners.forEach(callback => callback(error))
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
