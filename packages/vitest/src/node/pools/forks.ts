import type { FileSpecification } from '@vitest/runner'
import type { TinypoolChannel, Options as TinypoolOptions } from 'tinypool'
import type { RunnerRPC, RuntimeRPC } from '../../types/rpc'
import type { ContextRPC, ContextTestEnvironment } from '../../types/worker'
import type { Vitest } from '../core'
import type { PoolProcessOptions, ProcessPool, RunWithFiles } from '../pool'
import type { TestProject } from '../project'
import type { SerializedConfig } from '../types/config'
import EventEmitter from 'node:events'
import * as nodeos from 'node:os'
import { resolve } from 'node:path'
import v8 from 'node:v8'
import { createBirpc } from 'birpc'
import { Tinypool } from 'tinypool'
import { groupBy } from '../../utils/base'
import { wrapSerializableConfig } from '../../utils/config-helpers'
import { envsOrder, groupFilesByEnv } from '../../utils/test-helpers'
import { createMethodsRPC } from './rpc'

function createChildProcessChannel(project: TestProject, collect = false) {
  const emitter = new EventEmitter()

  const events = { message: 'message', response: 'response' }
  const channel: TinypoolChannel = {
    onMessage: callback => emitter.on(events.message, callback),
    postMessage: message => emitter.emit(events.response, message),
    onClose: () => emitter.removeAllListeners(),
  }

  const rpc = createBirpc<RunnerRPC, RuntimeRPC>(createMethodsRPC(project, { cacheFs: true, collect }), {
    eventNames: ['onCancel'],
    serialize: v8.serialize,
    deserialize: (v) => {
      try {
        return v8.deserialize(Buffer.from(v))
      }
      catch (error) {
        let stringified = ''

        try {
          stringified = `\nReceived value: ${JSON.stringify(v)}`
        }
        catch {}

        throw new Error(`[vitest-pool]: Unexpected call to process.send(). Make sure your test cases are not interfering with process's channel.${stringified}`, { cause: error })
      }
    },
    post(v) {
      emitter.emit(events.message, v)
    },
    on(fn) {
      emitter.on(events.response, fn)
    },
    onTimeoutError(functionName) {
      throw new Error(`[vitest-pool]: Timeout calling "${functionName}"`)
    },
  })

  project.vitest.onCancel(reason => rpc.onCancel(reason))

  return channel
}

export function createForksPool(
  vitest: Vitest,
  { execArgv, env }: PoolProcessOptions,
): ProcessPool {
  const numCpus
    = typeof nodeos.availableParallelism === 'function'
      ? nodeos.availableParallelism()
      : nodeos.cpus().length

  const threadsCount = vitest.config.watch
    ? Math.max(Math.floor(numCpus / 2), 1)
    : Math.max(numCpus - 1, 1)

  const poolOptions = vitest.config.poolOptions?.forks ?? {}

  const maxThreads
    = poolOptions.maxForks ?? vitest.config.maxWorkers ?? threadsCount
  const minThreads
    = poolOptions.minForks ?? vitest.config.minWorkers ?? Math.min(threadsCount, maxThreads)

  const worker = resolve(vitest.distPath, 'workers/forks.js')

  const options: TinypoolOptions = {
    runtime: 'child_process',
    filename: resolve(vitest.distPath, 'worker.js'),
    teardown: 'teardown',

    maxThreads,
    minThreads,

    env,
    execArgv: [...(poolOptions.execArgv ?? []), ...execArgv],

    terminateTimeout: vitest.config.teardownTimeout,
    concurrentTasksPerWorker: 1,
  }

  const isolated = poolOptions.isolate ?? true

  if (isolated) {
    options.isolateWorkers = true
  }

  if (poolOptions.singleFork || !vitest.config.fileParallelism) {
    options.maxThreads = 1
    options.minThreads = 1
  }

  const pool = new Tinypool(options)

  const runWithFiles = (name: string): RunWithFiles => {
    let id = 0

    async function runFiles(
      project: TestProject,
      config: SerializedConfig,
      files: FileSpecification[],
      environment: ContextTestEnvironment,
      invalidates: string[] = [],
    ) {
      const paths = files.map(f => f.filepath)
      vitest.state.clearFiles(project, paths)

      const channel = createChildProcessChannel(project, name === 'collect')
      const workerId = ++id
      const data: ContextRPC = {
        pool: 'forks',
        worker,
        config,
        files,
        invalidates,
        environment,
        workerId,
        projectName: project.name,
        providedContext: project.getProvidedContext(),
      }
      try {
        await pool.run(data, { name, channel })
      }
      catch (error) {
        // Worker got stuck and won't terminate - this may cause process to hang
        if (
          error instanceof Error
          && /Failed to terminate worker/.test(error.message)
        ) {
          vitest.state.addProcessTimeoutCause(
            `Failed to terminate worker while running ${paths.join(', ')}.`,
          )
        }
        // Intentionally cancelled
        else if (
          vitest.isCancelling
          && error instanceof Error
          && /The task has been cancelled/.test(error.message)
        ) {
          vitest.state.cancelFiles(paths, project)
        }
        else {
          throw error
        }
      }
    }

    return async (specs, invalidates) => {
      // Cancel pending tasks from pool when possible
      vitest.onCancel(() => pool.cancelPendingTasks())

      const configs = new WeakMap<TestProject, SerializedConfig>()
      const getConfig = (project: TestProject): SerializedConfig => {
        if (configs.has(project)) {
          return configs.get(project)!
        }

        const _config = project.getSerializableConfig()
        const config = wrapSerializableConfig(_config)

        configs.set(project, config)
        return config
      }

      const singleFork = specs.filter(
        spec => spec.project.config.poolOptions?.forks?.singleFork,
      )
      const multipleForks = specs.filter(
        spec => !spec.project.config.poolOptions?.forks?.singleFork,
      )

      if (multipleForks.length) {
        const filesByEnv = await groupFilesByEnv(multipleForks)
        const files = Object.values(filesByEnv).flat()
        const results: PromiseSettledResult<void>[] = []

        if (isolated) {
          results.push(
            ...(await Promise.allSettled(
              files.map(({ file, environment, project }) =>
                runFiles(
                  project,
                  getConfig(project),
                  [file],
                  environment,
                  invalidates,
                ),
              ),
            )),
          )
        }
        else {
          // When isolation is disabled, we still need to isolate environments and workspace projects from each other.
          // Tasks are still running parallel but environments are isolated between tasks.
          const grouped = groupBy(
            files,
            ({ project, environment }) =>
              project.name
              + environment.name
              + JSON.stringify(environment.options),
          )

          for (const group of Object.values(grouped)) {
            // Push all files to pool's queue
            results.push(
              ...(await Promise.allSettled(
                group.map(({ file, environment, project }) =>
                  runFiles(
                    project,
                    getConfig(project),
                    [file],
                    environment,
                    invalidates,
                  ),
                ),
              )),
            )

            // Once all tasks are running or finished, recycle worker for isolation.
            // On-going workers will run in the previous environment.
            await new Promise<void>(resolve =>
              pool.queueSize === 0 ? resolve() : pool.once('drain', resolve),
            )
            await pool.recycleWorkers()
          }
        }

        const errors = results
          .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
          .map(r => r.reason)
        if (errors.length > 0) {
          throw new AggregateError(
            errors,
            'Errors occurred while running tests. For more information, see serialized error.',
          )
        }
      }

      if (singleFork.length) {
        const filesByEnv = await groupFilesByEnv(singleFork)
        const envs = envsOrder.concat(
          Object.keys(filesByEnv).filter(env => !envsOrder.includes(env)),
        )

        for (const env of envs) {
          const files = filesByEnv[env]

          if (!files?.length) {
            continue
          }

          const filesByOptions = groupBy(
            files,
            ({ project, environment }) =>
              project.name + JSON.stringify(environment.options),
          )

          for (const files of Object.values(filesByOptions)) {
            // Always run environments isolated between each other
            await pool.recycleWorkers()

            const filenames = files.map(f => f.file)
            await runFiles(
              files[0].project,
              getConfig(files[0].project),
              filenames,
              files[0].environment,
              invalidates,
            )
          }
        }
      }
    }
  }

  return {
    name: 'forks',
    runTests: runWithFiles('run'),
    collectTests: runWithFiles('collect'),
    close: () => pool.destroy(),
  }
}
