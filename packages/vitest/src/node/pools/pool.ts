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

// escape hatch while the adaptive worker scaling is validated across platforms
const isAdaptiveScalingEnabled = process.env.VITEST_POOL_ADAPTIVE !== '0'

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

  // Workers start one at a time while the queue justifies another one
  // (mirrors the browser pool's adaptive session scaling): every worker pays
  // a spawn + runtime bring-up that competes with the already-running workers
  // for the same CPUs and Vite server, so fast suites finish sooner with
  // fewer workers, while suites with slower files still scale up to
  // `maxWorkers`.
  private _startingCount = 0
  // refined with the measured duration after every worker start
  private _spawnCost = 150
  // EMA of how long a single task takes; undefined until the first signal,
  // which means "keep starting workers like before". A reused worker's first
  // task pays the environment bring-up on top of the test, so it only counts
  // when the worker cannot be reused (then it is the true per-task cost).
  private _taskCostEma: number | undefined

  constructor(private options: Options, private logger: Logger) {}

  setMaxWorkers(maxWorkers: number): void {
    this.maxWorkers = maxWorkers

    this.workerIds = new Map(
      Array.from({ length: maxWorkers }).fill(0).map((_, i) => [i + 1, true]),
    )

    // a new task group can have a completely different per-task cost
    // (different pool, environment or project — e.g. typecheck tasks after
    // unit tests), so its scaling starts from a clean signal
    this._taskCostEma = undefined
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

    if (isAdaptiveScalingEnabled && !this.canScheduleNext()) {
      // re-evaluated when the in-flight worker start settles or a task
      // finishes — both end with another `schedule()` call
      return
    }

    const { task, resolver, method } = this.queue.shift()!

    try {
      let isMemoryLimitReached = false
      const runner = this.getPoolRunner(task, method)
      const isFreshRunner = !runner.isStarted

      const poolId = runner.poolId ?? this.getConcurrencyId()
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
          runner.off('error', onTaskError)
          resolver.resolve()
        }
      }

      function onTaskError(error: unknown) {
        runner.off('message', onFinished)
        runner.off('error', onTaskError)
        resolver.reject(new Error(`[vitest-pool]: Worker ${task.worker} emitted error.`, { cause: error }))
      }

      runner.on('message', onFinished)
      runner.on('error', onTaskError)

      if (!runner.isStarted) {
        const id = setTimeout(
          () => resolver.reject(new Error(`[vitest-pool]: Timeout starting ${task.worker} runner.`)),
          WORKER_START_TIMEOUT,
        )

        this._startingCount++
        const startedAt = performance.now()

        await runner.start({ workerId: task.context.workerId })
          .catch(error =>
            resolver.reject(
              new Error(`[vitest-pool]: Failed to start ${task.worker} worker for test files ${formatFiles(task)}.`, { cause: error }),
            ),
          )
          .finally(() => {
            clearTimeout(id)
            this._startingCount--
          })

        if (!resolver.isRejected) {
          this._spawnCost = performance.now() - startedAt
        }

        // the next worker can start while this one runs its task
        void this.schedule()
      }

      let span: Span | undefined
      const requestedAt = performance.now()

      if (!resolver.isRejected) {
        span = runner.startTracesSpan(`vitest.worker.${method}`)

        // Start running the test in the worker
        runner.request(method, task.context)
      }

      await resolver.promise
        .catch(error => span?.recordException(error))
        .finally(() => span?.end())

      // the EMA only informs the scaling of reusable workers, and a fresh
      // worker's first task pays the environment bring-up on top of the
      // test itself — only steady-state tasks of reused workers count
      if (!resolver.isRejected && task.isolate === false && !isFreshRunner) {
        const taskCost = performance.now() - requestedAt
        this._taskCostEma = this._taskCostEma == null
          ? taskCost
          : this._taskCostEma * 0.7 + taskCost * 0.3
      }

      const index = this.activeTasks.indexOf(activeTask)
      if (index !== -1) {
        this.activeTasks.splice(index, 1)
      }

      if (
        !task.isolate
        && !runner.isTerminated
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

  private canScheduleNext(): boolean {
    const { task } = this.queue[0]

    // isolated tasks pay a worker per task no matter what — there is no
    // avoidable bring-up cost for the scaling to save, so they keep the
    // unrestricted behavior
    if (task.isolate !== false) {
      return true
    }

    // an idle reusable worker adds no bring-up cost
    if (this.sharedRunners.some(runner => isEqualRunner(runner, task))) {
      return true
    }

    // fresh workers ramp up by doubling (in-flight starts never exceed the
    // workers that already run) — the queue may no longer justify more
    // workers by the time the current batch is up, while a long queue still
    // reaches `maxWorkers` in logarithmic time instead of one by one
    const startedWorkers = this.activeTasks.length - this._startingCount
    if (this._startingCount >= Math.max(1, startedWorkers)) {
      return false
    }

    // the first worker always starts; without a per-task signal keep the old
    // behavior of scaling straight up to `maxWorkers`
    if (this.activeTasks.length === 0 || this._taskCostEma == null) {
      return true
    }

    // only pay for another worker when the remaining work, split across the
    // workers we already have, still takes considerably longer than a worker
    // start costs — a new worker does not just cost its own bring-up, it
    // also competes with the running workers for the same CPUs
    const projectedDrainMs
      = (this.queue.length * this._taskCostEma) / this.activeTasks.length
    return projectedDrainMs > Math.max(this._spawnCost, 50) * 2
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

  private getConcurrencyId() {
    let concurrencyId: number | undefined

    this.workerIds.forEach((state, id) => {
      if (state && concurrencyId == null) {
        concurrencyId = id
        this.workerIds.set(id, false)
      }
    })

    if (concurrencyId == null) {
      throw new Error('Cannot set concurrency id because there are no valid free ids.')
    }

    return concurrencyId
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
    if (!Object.hasOwn(obj2, key) || !deepEqual(obj1[key], obj2[key])) {
      return false
    }
  }

  return true
}
