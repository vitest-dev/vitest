import type { Span } from '@opentelemetry/api'
import type { ContextTestEnvironment } from '../../types/worker'
import type { Logger } from '../logger'
import type { StateManager } from '../state'
import type { PoolOptions, PoolTask, WorkerResponse } from './types'
import { PoolRunner } from './poolRunner'
import { ForksPoolWorker } from './workers/forksWorker'
import { ThreadsPoolWorker } from './workers/threadsWorker'
import { TypecheckPoolWorker } from './workers/typecheckWorker'
import { VmForksPoolWorker } from './workers/vmForksWorker'
import { VmThreadsPoolWorker } from './workers/vmThreadsWorker'

const WORKER_START_TIMEOUT = 90_000

interface Options {
  distPath: string
  teardownTimeout: number
  state: StateManager
}

interface QueuedTask {
  task: PoolTask
  resolver: ReturnType<typeof withResolvers>
  method: 'run' | 'collect'
}

interface ActiveTask extends QueuedTask {
  cancelTask: (options?: { force: boolean }) => Promise<void>
}

export class Pool {
  private maxWorkers: number = 0
  private workerIds = new Map<number, boolean>()

  private queue: QueuedTask[] = []
  private activeTasks: ActiveTask[] = []
  private sharedRunners: PoolRunner[] = []
  private exitPromises: Promise<void>[] = []
  private _isCancelling: boolean = false

  constructor(private options: Options, private logger: Logger) {}

  setMaxWorkers(maxWorkers: number): void {
    this.maxWorkers = maxWorkers

    this.workerIds = new Map(
      Array.from({ length: maxWorkers }).fill(0).map((_, i) => [i + 1, true]),
    )
  }

  async run(task: PoolTask, method: 'run' | 'collect'): Promise<void> {
    // Prevent new tasks from being queued during cancellation
    if (this._isCancelling) {
      throw new Error('[vitest-pool]: Cannot run tasks while pool is cancelling')
    }

    // Every runner related failure should make this promise reject so that it's picked by pool.
    // This resolver is used to make the error handling in recursive queue easier.
    const testFinish = withResolvers()

    this.queue.push({ task, resolver: testFinish, method })
    void this.schedule()

    await testFinish.promise
  }

  private async schedule(): Promise<void> {
    if (this.queue.length === 0 || this.activeTasks.length >= this.maxWorkers) {
      return
    }

    const { task, resolver, method } = this.queue.shift()!

    try {
      let isMemoryLimitReached = false
      const runner = this.getPoolRunner(task, method)

      const poolId = runner.poolId ?? this.getWorkerId()
      runner.poolId = poolId

      const activeTask = { task, resolver, method, cancelTask }
      this.activeTasks.push(activeTask)

      // active tasks receive cancel signal and shut down gracefully
      async function cancelTask(options?: { force: boolean }) {
        if (options?.force) {
          await runner.stop({ force: true })
        }

        await runner.waitForTerminated()
        resolver.reject(new Error('Cancelled'))
      }

      const onFinished = (message: WorkerResponse) => {
        if (message?.__vitest_worker_response__ && message.type === 'testfileFinished') {
          if (task.memoryLimit && message.usedMemory) {
            isMemoryLimitReached = message.usedMemory >= task.memoryLimit
          }
          if (message.error) {
            this.options.state.catchError(message.error, 'Test Run Error')
          }

          runner.off('message', onFinished)
          resolver.resolve()
        }
      }

      runner.on('message', onFinished)

      if (!runner.isStarted) {
        runner.on('error', (error) => {
          resolver.reject(
            new Error(`[vitest-pool]: Worker ${task.worker} emitted error.`, { cause: error }),
          )
        })

        const id = setTimeout(
          () => resolver.reject(new Error(`[vitest-pool]: Timeout starting ${task.worker} runner.`)),
          WORKER_START_TIMEOUT,
        )

        await runner.start({ workerId: task.context.workerId })
          .catch(error =>
            resolver.reject(
              new Error(`[vitest-pool]: Failed to start ${task.worker} worker for test files ${formatFiles(task)}.`, { cause: error }),
            ),
          )
          .finally(() => clearTimeout(id))
      }

      let span: Span | undefined

      if (!resolver.isRejected) {
        span = runner.startTracesSpan(`vitest.worker.${method}`)

        // Start running the test in the worker
        runner.request(method, task.context)
      }

      await resolver.promise
        .catch(error => span?.recordException(error))
        .finally(() => span?.end())

      const index = this.activeTasks.indexOf(activeTask)
      if (index !== -1) {
        this.activeTasks.splice(index, 1)
      }

      if (
        !task.isolate
        && !isMemoryLimitReached
        && this.queue[0]?.task.isolate === false
        && isEqualRunner(runner, this.queue[0].task)
      ) {
        this.sharedRunners.push(runner)
        return this.schedule()
      }

      // Runner terminations are started but not awaited until the end of full run.
      // Runner termination can also already start from task cancellation.
      if (!runner.isTerminated) {
        const id = setTimeout(
          () => this.logger.error(`[vitest-pool]: Timeout terminating ${task.worker} worker for test files ${formatFiles(task)}.`),
          this.options.teardownTimeout,
        )

        this.exitPromises.push(
          runner.stop({ force: resolver.isRejected })
            .then(() => clearTimeout(id))
            .catch(error => this.logger.error(`[vitest-pool]: Failed to terminate ${task.worker} worker for test files ${formatFiles(task)}.`, error)),
        )
      }

      this.freeWorkerId(poolId)
    }

    // This is mostly to avoid zombie workers when/if Vitest internals run into errors
    catch (error) {
      return resolver.reject(error)
    }

    return this.schedule()
  }

  async cancel(): Promise<void> {
    // Force exit if previous cancel is still on-going
    // for example when user does 'CTRL+c' twice in row
    const force = this._isCancelling

    // Set flag to prevent new tasks from being queued
    this._isCancelling = true

    const pendingTasks = this.queue.splice(0)

    if (pendingTasks.length) {
      const error = new Error('Cancelled')
      pendingTasks.forEach(task => task.resolver.reject(error))
    }

    await Promise.all(this.activeTasks.map(task => task.cancelTask({ force })))
    this.activeTasks = []

    await Promise.all(this.sharedRunners.map(runner => runner.stop()))
    this.sharedRunners = []

    await Promise.all(this.exitPromises)
    this.exitPromises = []

    this.workerIds.forEach((_, id) => this.freeWorkerId(id))

    // Reset flag after cancellation completes
    this._isCancelling = false
  }

  async close(): Promise<void> {
    await this.cancel()
  }

  private getPoolRunner(task: PoolTask, method: 'run' | 'collect'): PoolRunner {
    if (task.isolate === false) {
      const index = this.sharedRunners.findIndex(runner => isEqualRunner(runner, task))

      if (index !== -1) {
        const runner = this.sharedRunners.splice(index, 1)[0]
        runner.reconfigure(task)
        return runner
      }
    }

    const options: PoolOptions = {
      distPath: this.options.distPath,
      project: task.project,
      method,
      environment: task.context.environment,
      env: task.env,
      execArgv: task.execArgv,
    }

    switch (task.worker) {
      case 'forks':
        return new PoolRunner(options, new ForksPoolWorker(options))

      case 'vmForks':
        return new PoolRunner(options, new VmForksPoolWorker(options))

      case 'threads':
        return new PoolRunner(options, new ThreadsPoolWorker(options))

      case 'vmThreads':
        return new PoolRunner(options, new VmThreadsPoolWorker(options))

      case 'typescript':
        return new PoolRunner(options, new TypecheckPoolWorker(options))
    }

    const customPool = task.project.config.poolRunner
    if (customPool != null && customPool.name === task.worker) {
      return new PoolRunner(options, customPool.createPoolWorker(options))
    }

    throw new Error(`Runner ${task.worker} is not supported. Test files: ${formatFiles(task)}.`)
  }

  private getWorkerId() {
    let workerId = 0

    this.workerIds.forEach((state, id) => {
      if (state && !workerId) {
        workerId = id
        this.workerIds.set(id, false)
      }
    })

    return workerId
  }

  private freeWorkerId(id: number) {
    this.workerIds.set(id, true)
  }
}

function withResolvers() {
  let resolve = () => {}
  let reject = (_error: unknown) => {}

  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })

  const resolver = {
    promise,
    resolve,
    reject: (reason: unknown) => {
      resolver.isRejected = true
      reject(reason)
    },
    isRejected: false,
  }

  return resolver
}

function formatFiles(task: PoolTask) {
  return task.context.files.map(file => file.filepath).join(', ')
}

function isEqualRunner(runner: PoolRunner, task: PoolTask) {
  if (task.isolate) {
    throw new Error('Isolated tasks should not share runners')
  }
  if (runner.worker.name !== task.worker || runner.project !== task.project) {
    return false
  }
  // by default, check that the environments are the same
  // some workers (like vmThreads/vmForks) do not need this check
  if (!runner.worker.canReuse) {
    return isEnvironmentEqual(task.context.environment, runner.environment)
  }
  return runner.worker.canReuse(task)
}

function isEnvironmentEqual(env1: ContextTestEnvironment, env2: ContextTestEnvironment): boolean {
  if (env1.name !== env2.name) {
    return false
  }
  return deepEqual(env1.options, env2.options)
}

function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) {
    return true
  }
  if (obj1 == null || obj2 == null) {
    return obj1 === obj2
  }
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    return false
  }

  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)

  if (keys1.length !== keys2.length) {
    return false
  }

  for (const key of keys1) {
    if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) {
      return false
    }
  }

  return true
}
