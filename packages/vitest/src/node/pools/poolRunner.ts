import type { Span, TimeInput } from '@opentelemetry/api'
import type { DeferPromise } from '@vitest/utils/helpers'
import type { BirpcReturn } from 'birpc'
import type { RunnerRPC, RuntimeRPC } from '../../types/rpc'
import type { ContextTestEnvironment, WorkerExecuteContext } from '../../types/worker'
import type { Traces } from '../../utils/traces'
import type { TestProject } from '../project'
import type { PoolOptions, PoolRunnerOTEL, PoolTask, PoolWorker, WorkerRequest, WorkerResponse } from './types'
import { EventEmitter } from 'node:events'
import { createDefer } from '@vitest/utils/helpers'
import { createBirpc } from 'birpc'
import { createMethodsRPC } from './rpc'

enum RunnerState {
  IDLE = 'idle',
  STARTING = 'starting',
  STARTED = 'started',
  START_FAILURE = 'start_failure',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
}

interface StopOptions {
  /**
   * **Do not use unless you have good reason to.**
   *
   * Indicates whether to skip waiting for worker's response for `{ type: 'stop' }` message or not.
   * By default `.stop()` terminates the workers gracefully by sending them stop-message
   * and waiting for workers response, so that workers can do proper teardown.
   *
   * Force exit is used when user presses `CTRL+c` twice in row and intentionally does
   * non-graceful exit. For example in cases where worker is stuck on synchronous thread
   * blocking function call and it won't response to `{ type: 'stop' }` messages.
   */
  force: boolean
}

const START_TIMEOUT = 60_000
const STOP_TIMEOUT = 60_000

/** @experimental */
export class PoolRunner {
  /** Exposed to test runner as `VITEST_POOL_ID`. Value is between 1-`maxWorkers`. */
  public poolId: number | undefined = undefined

  public readonly project: TestProject
  public environment: ContextTestEnvironment

  private _state: RunnerState = RunnerState.IDLE
  private _operationLock: DeferPromise<void> | null = null
  private _terminatePromise: DeferPromise<void> = createDefer()

  private _eventEmitter: EventEmitter<{
    message: [WorkerResponse]
    error: [Error]
    rpc: [unknown]
  }> = new EventEmitter()

  private _offCancel: () => void
  private _rpc: BirpcReturn<RunnerRPC, RuntimeRPC>

  private _otel: PoolRunnerOTEL | null = null
  private _traces: Traces

  public get isTerminated(): boolean {
    return this._state === RunnerState.STOPPED
  }

  public waitForTerminated(): Promise<void> {
    return this._terminatePromise
  }

  public get isStarted(): boolean {
    return this._state === RunnerState.STARTED
  }

  constructor(options: PoolOptions, public worker: PoolWorker) {
    this.project = options.project
    this.environment = options.environment

    const vitest = this.project.vitest
    this._traces = vitest._traces
    if (this._traces.isEnabled()) {
      const { span: workerSpan, context } = this._traces.startContextSpan('vitest.worker')
      this._otel = {
        span: workerSpan,
        workerContext: context,
        files: [],
      }
      this._otel.span.setAttributes({
        'vitest.worker.name': this.worker.name,
        'vitest.project': this.project.name,
        'vitest.environment': this.environment.name,
      })
    }

    this._rpc = createBirpc<RunnerRPC, RuntimeRPC>(
      createMethodsRPC(this.project, {
        collect: options.method === 'collect',
        cacheFs: worker.cacheFs,
      }),
      {
        eventNames: ['onCancel'],
        post: (request) => {
          if (this._state !== RunnerState.STOPPING && this._state !== RunnerState.STOPPED) {
            this.postMessage(request)
          }
        },
        on: callback => this._eventEmitter.on('rpc', callback),
        timeout: -1,
      },
    )

    this._offCancel = vitest.onCancel(reason => this._rpc.onCancel(reason))
  }

  /**
   * "reconfigure" can only be called if `environment` is different, since different project always
   * requires a new PoolRunner instance.
   */
  public reconfigure(task: PoolTask): void {
    this.environment = task.context.environment
    this._otel?.span.setAttribute('vitest.environment', this.environment.name)
  }

  postMessage(message: WorkerRequest): void {
    // Only send messages when runner is active (not fully stopped)
    // Allow sending during STOPPING state for the 'stop' message itself
    if (this._state !== RunnerState.STOPPED) {
      return this.worker.send(message)
    }
  }

  startTracesSpan(name: string): Span {
    const traces = this._traces
    if (!this._otel) {
      return traces.startSpan(name)
    }
    const { span, context } = traces.startContextSpan(name, this._otel.workerContext)
    this._otel.currentContext = context
    const end = span.end.bind(span)
    span.end = (endTime?: TimeInput) => {
      this._otel!.currentContext = undefined
      return end(endTime)
    }
    return span
  }

  request(method: 'run' | 'collect', context: WorkerExecuteContext): void {
    this._otel?.files.push(...context.files.map(f => f.filepath))
    return this.postMessage({
      __vitest_worker_request__: true,
      type: method,
      context,
      otelCarrier: this.getOTELCarrier(),
    } satisfies WorkerRequest)
  }

  private getOTELCarrier() {
    const activeContext = this._otel?.currentContext || this._otel?.workerContext
    return activeContext
      ? this._traces.getContextCarrier(activeContext)
      : undefined
  }

  async start(options: { workerId: number }): Promise<void> {
    // Wait for any ongoing operation to complete
    if (this._operationLock) {
      await this._operationLock
    }

    if (this._state === RunnerState.STARTED || this._state === RunnerState.STARTING) {
      return
    }

    if (this._state === RunnerState.STOPPED) {
      throw new Error('[vitest-pool-runner]: Cannot start a stopped runner')
    }

    // Create operation lock to prevent concurrent start/stop
    this._operationLock = createDefer()

    let startSpan: Span | undefined
    try {
      this._state = RunnerState.STARTING

      await this._traces.$(
        `vitest.${this.worker.name}.start`,
        { context: this._otel?.workerContext },
        () => this.worker.start(),
      )

      // Attach event listeners AFTER starting worker to avoid issues
      // if worker.start() fails
      this.worker.on('error', this.emitWorkerError)
      this.worker.on('exit', this.emitUnexpectedExit)
      this.worker.on('message', this.emitWorkerMessage)

      startSpan = this.startTracesSpan('vitest.worker.start')
      const startPromise = this.withTimeout(this.waitForStart(), START_TIMEOUT)
      const globalConfig = this.project.vitest.config.experimental.openTelemetry
      const projectConfig = this.project.config.experimental.openTelemetry

      const tracesEnabled = projectConfig?.enabled ?? globalConfig?.enabled === true
      const tracesSdk = projectConfig?.sdkPath ?? globalConfig?.sdkPath

      this.postMessage({
        type: 'start',
        poolId: this.poolId!,
        workerId: options.workerId,
        __vitest_worker_request__: true,
        options: {
          reportMemory: this.worker.reportMemory ?? false,
        },
        context: {
          environment: {
            name: this.environment.name,
            options: this.environment.options,
          },
          config: this.project.serializedConfig,
          pool: this.worker.name,
        },
        traces: {
          enabled: tracesEnabled,
          sdkPath: tracesSdk,
          otelCarrier: this.getOTELCarrier(),
        },
      })

      await startPromise

      this._state = RunnerState.STARTED
    }
    catch (error: any) {
      this._state = RunnerState.START_FAILURE
      startSpan?.recordException(error)
      throw error
    }
    finally {
      startSpan?.end()
      this._operationLock.resolve()
      this._operationLock = null
    }
  }

  async stop(options?: StopOptions): Promise<void> {
    // Wait for any ongoing operation to complete
    if (this._operationLock) {
      await this._operationLock
    }

    if (this._state === RunnerState.STOPPED || this._state === RunnerState.STOPPING) {
      return
    }

    this._otel?.span.setAttribute('vitest.worker.files', this._otel.files)

    if (this._state === RunnerState.IDLE) {
      this._otel?.span.end()
      this._state = RunnerState.STOPPED
      return
    }

    // Create operation lock to prevent concurrent start/stop
    this._operationLock = createDefer()

    try {
      this._state = RunnerState.STOPPING

      // Remove exit listener early to avoid "unexpected exit" errors during shutdown
      this.worker.off('exit', this.emitUnexpectedExit)

      const stopSpan = this.startTracesSpan('vitest.worker.stop')
      await this.withTimeout(
        new Promise<void>((resolve) => {
          const onStop = (response: WorkerResponse) => {
            if (response.type === 'stopped') {
              if (response.error) {
                stopSpan.recordException(response.error as Error)
                this.project.vitest.state.catchError(
                  response.error,
                  'Teardown Error',
                )
              }

              resolve()
              this.off('message', onStop)
            }
          }

          // Don't wait for graceful exit's response when force exiting
          if (options?.force) {
            return onStop({ type: 'stopped', __vitest_worker_response__: true })
          }

          this.on('message', onStop)
          this.postMessage({
            type: 'stop',
            __vitest_worker_request__: true,
            otelCarrier: this.getOTELCarrier(),
          })
        }),
        STOP_TIMEOUT,
      ).finally(() => {
        stopSpan.end()
      })

      this._eventEmitter.removeAllListeners()
      this._offCancel()
      this._rpc.$close(new Error('[vitest-pool-runner]: Pending methods while closing rpc'))

      // Stop the worker process (this sets _fork/_thread to undefined)
      // Worker's event listeners (error, message) are implicitly removed when worker terminates
      await this._traces.$(
        `vitest.${this.worker.name}.stop`,
        { context: this._otel?.workerContext },
        () => this.worker.stop(),
      )

      this._state = RunnerState.STOPPED
    }
    catch (error) {
      // Ensure we transition to stopped state even on error
      this._state = RunnerState.STOPPED
      throw error
    }
    finally {
      this._operationLock.resolve()
      this._operationLock = null
      this._otel?.span.end()
      this._terminatePromise.resolve()
    }
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

  private emitWorkerError = (maybeError: unknown): void => {
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
    return new Promise<void>((resolve, reject) => {
      const onStart = (message: WorkerResponse) => {
        if (message.type === 'started') {
          this.off('message', onStart)
          if (message.error) {
            reject(message.error)
          }
          else {
            resolve()
          }
        }
      }

      this.on('message', onStart)
    })
  }

  private withTimeout(promise: Promise<unknown>, timeout: number) {
    return new Promise<unknown>((resolve_, reject_) => {
      const timer = setTimeout(
        () => reject(new Error('[vitest-pool-runner]: Timeout waiting for worker to respond')),
        timeout,
      )

      function resolve(value: unknown) {
        clearTimeout(timer)
        resolve_(value)
      }
      function reject(error: Error) {
        clearTimeout(timer)
        reject_(error)
      }

      promise.then(resolve, reject)
    })
  }
}
