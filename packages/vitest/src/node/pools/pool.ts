import type { Logger } from '../logger'
import type { StateManager } from '../state'
import type { PoolOptions, PoolTask, WorkerResponse } from './types'
import { PoolRunner } from './poolRunner'
import { ForksPoolWorker } from './workers/forksWorker'
import { ThreadsPoolWorker } from './workers/threadsWorker'
import { TypecheckPoolWorker } from './workers/typecheckWorker'
import { VmForksPoolWorker } from './workers/vmForksWorker'
import { VmThreadsPoolWorker } from './workers/vmThreadsWorker'

const WORKER_START_TIMEOUT = 5_000

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
  cancelTask: () => Promise<void>
}

export class Pool {
  private maxWorkers: number = 0
  private workerIds = new Map<number, boolean>()

  private queue: QueuedTask[] = []
  private activeTasks: ActiveTask[] = []
  private sharedRunners: PoolRunner[] = []
  private exitPromises: Promise<void>[] = []

  constructor(private options: Options, private logger: Logger) {}

  setMaxWorkers(maxWorkers: number): void {
    this.maxWorkers = maxWorkers

    this.workerIds = new Map(
      Array.from({ length: maxWorkers }).fill(0).map((_, i) => [i + 1, true]),
    )
  }

  async run(task: PoolTask, method: 'run' | 'collect'): Promise<void> {
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

      const activeTask = { task, resolver, method, cancelTask }
      this.activeTasks.push(activeTask)

      runner.on('error', error => resolver.reject(new Error(`[vitest-pool]: Worker ${task.worker} emitted error`, { cause: error })))

      async function cancelTask() {
        await runner.stop()
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
        const id = setTimeout(
          () => resolver.reject(new Error(`[vitest-pool]: Timeout starting ${task.worker} runner.`)),
          WORKER_START_TIMEOUT,
        )

        await runner.start()
        clearTimeout(id)
      }

      const poolId = runner.poolId ?? this.getWorkerId()
      runner.poolId = poolId

      // Start running the test in the worker
      runner.postMessage({
        __vitest_worker_request__: true,
        type: method,
        context: task.context,
        poolId,
      })

      await resolver.promise

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
        return await this.schedule()
      }

      // Runner terminations are started but not awaited until the end of full run.
      // Runner termination can also already start from task cancellation.
      if (!runner.isTerminating) {
        const id = setTimeout(
          () => this.logger.error(`[vitest-pool]: Timeout terminating ${task.worker} worker for test files ${formatFiles(task)}.`),
          this.options.teardownTimeout,
        )

        this.exitPromises.push(
          runner.stop()
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
    const pendingTasks = this.queue.splice(0)

    if (pendingTasks.length) {
      const error = new Error('Cancelled')
      pendingTasks.forEach(task => task.resolver.reject(error))
    }

    const activeTasks = this.activeTasks.splice(0)
    await Promise.all(activeTasks.map(task => task.cancelTask()))

    const sharedRunners = this.sharedRunners.splice(0)
    await Promise.all(sharedRunners.map(runner => runner.stop()))

    await Promise.all(this.exitPromises.splice(0))

    this.workerIds.forEach((_, id) => this.freeWorkerId(id))
  }

  async close(): Promise<void> {
    await this.cancel()
  }

  private getPoolRunner(task: PoolTask, method: 'run' | 'collect'): PoolRunner {
    if (task.isolate === false) {
      const index = this.sharedRunners.findIndex(runner => isEqualRunner(runner, task))

      if (index !== -1) {
        return this.sharedRunners.splice(index, 1)[0]
      }
    }

    const options: PoolOptions = {
      distPath: this.options.distPath,
      project: task.project,
      method,
      environment: task.context.environment.name,
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

  return { resolve, reject, promise }
}

function formatFiles(task: PoolTask) {
  return task.context.files.map(file => file.filepath).join(', ')
}

function isEqualRunner(runner: PoolRunner, task: PoolTask) {
  if (task.isolate) {
    throw new Error('Isolated tasks should not share runners')
  }

  return (
    runner.worker.name === task.worker
    && runner.project === task.project
    && runner.environment === task.context.environment.name
    && runner.worker.execArgv.every((arg, index) => task.execArgv[index] === arg)
    && isEnvEqual(runner.worker.env, task.env)
  )
}

function isEnvEqual(a: PoolOptions['env'], b: PoolTask['env']) {
  const keys = Object.keys(a)

  if (keys.length !== Object.keys(b).length) {
    return false
  }

  return keys.every(key => a[key] === b[key])
}
