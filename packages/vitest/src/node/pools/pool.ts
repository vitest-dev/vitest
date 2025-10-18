import type { Logger } from '../logger'
import type { StateManager } from '../state'
import type { PoolRuntime, PoolTask, WorkerResponse } from './types'
import { ForksRuntime } from './runtimes/forks'
import { ThreadsRuntime } from './runtimes/threads'
import { TypecheckRuntime } from './runtimes/typecheck'
import { VmForksRuntime } from './runtimes/vmForks'
import { VmThreadsRuntime } from './runtimes/vmThreads'

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
  private sharedRuntimes: PoolRuntime[] = []
  private exitPromises: Promise<void>[] = []

  constructor(private options: Options, private logger: Logger) {}

  setMaxWorkers(maxWorkers: number): void {
    this.maxWorkers = maxWorkers

    this.workerIds = new Map(
      Array.from({ length: maxWorkers }).fill(0).map((_, i) => [i + 1, true]),
    )
  }

  async run(task: PoolTask, method: 'run' | 'collect'): Promise<void> {
    // Every runtime related failure should make this promise reject so that it's picked by pool.
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
      const runtime = this.getRuntime(task, method)

      const activeTask = { task, resolver, method, cancelTask }
      this.activeTasks.push(activeTask)

      runtime.on('error', error => resolver.reject(new Error(`[vitest-pool]: Runtime ${task.runtime} emitted error`, { cause: error })))

      async function cancelTask() {
        await runtime.stop()
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

          runtime.off('message', onFinished)
          resolver.resolve()
        }
      }

      runtime.on('message', onFinished)

      if (!runtime.isStarted) {
        const id = setTimeout(
          () => resolver.reject(new Error(`[vitest-pool]: Timeout starting ${task.runtime} runtime.`)),
          WORKER_START_TIMEOUT,
        )

        await runtime.start({ env: task.env, execArgv: task.execArgv })
        clearTimeout(id)
      }

      const poolId = runtime.poolId ?? this.getWorkerId()
      runtime.poolId = poolId

      // Start running the test in the worker
      runtime.postMessage({
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
        && isEqualRuntime(runtime, this.queue[0].task)
      ) {
        this.sharedRuntimes.push(runtime)
        return this.schedule()
      }

      const id = setTimeout(
        () => this.logger.error(`[vitest-pool]: Timeout terminating ${task.runtime} worker for test files ${formatFiles(task)}.`),
        this.options.teardownTimeout,
      )

      // Runtime terminations are started but not awaited until the end of full run
      this.exitPromises.push(
        runtime.stop()
          .then(() => clearTimeout(id))
          .catch(error => this.logger.error(`[vitest-pool]: Failed to terminate ${task.runtime} worker for test files ${formatFiles(task)}.`, error)),
      )

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

    const sharedRuntimes = this.sharedRuntimes.splice(0)
    await Promise.all(sharedRuntimes.map(runtime => runtime.stop()))

    await Promise.all(this.exitPromises.splice(0))

    this.workerIds.forEach((_, id) => this.freeWorkerId(id))
  }

  async close(): Promise<void> {
    await this.cancel()
  }

  private getRuntime(task: PoolTask, method: 'run' | 'collect'): PoolRuntime {
    if (task.isolate === false) {
      const index = this.sharedRuntimes.findIndex(runtime => isEqualRuntime(runtime, task))

      if (index !== -1) {
        return this.sharedRuntimes.splice(index, 1)[0]
      }
    }

    const options = {
      distPath: this.options.distPath,
      project: task.project,
      method,
      environment: task.context.environment.name,
    }

    switch (task.runtime) {
      case 'forks':
        return new ForksRuntime(options)

      case 'vmForks':
        return new VmForksRuntime(options)

      case 'threads':
        return new ThreadsRuntime(options)

      case 'vmThreads':
        return new VmThreadsRuntime(options)

      case 'typescript':
        return new TypecheckRuntime(options)
    }

    const CustomRuntime = task.project.config.poolRuntime
    if (CustomRuntime != null && CustomRuntime.runtime === task.runtime) {
      return new CustomRuntime(options)
    }

    throw new Error(`Runtime ${task.runtime} not supported. Test files: ${formatFiles(task)}.`)
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

function isEqualRuntime(runtime: PoolRuntime, task: PoolTask) {
  if (task.isolate) {
    throw new Error('Isolated tasks should not share runtimes')
  }

  // TODO: Compare add runtime.options.env
  return runtime.name === task.runtime
    && runtime.options.project === task.project
    && runtime.options.environment === task.context.environment.name
}
