import type { FileSpecification } from '@vitest/runner'
import type { TinypoolChannel, Options as TinypoolOptions } from 'tinypool'
import type { RunnerRPC, RuntimeRPC } from '../../types/rpc'
import type { ContextRPC, ContextTestEnvironment } from '../../types/worker'
import type { Vitest } from '../core'
import type { PoolProcessOptions, ProcessPool, RunWithFiles } from '../pool'
import type { TestProject } from '../project'
import type { ResolvedConfig, SerializedConfig } from '../types/config'
import EventEmitter from 'node:events'
import * as nodeos from 'node:os'
import { resolve } from 'node:path'
import v8 from 'node:v8'
import { createBirpc } from 'birpc'
import Tinypool from 'tinypool'
import { rootDir } from '../../paths'
import { wrapSerializableConfig } from '../../utils/config-helpers'
import { getWorkerMemoryLimit, stringToBytes } from '../../utils/memory-limit'
import { groupFilesByEnv } from '../../utils/test-helpers'
import { createMethodsRPC } from './rpc'

const suppressWarningsPath = resolve(rootDir, './suppress-warnings.cjs')

function createChildProcessChannel(project: TestProject, collect: boolean) {
  const emitter = new EventEmitter()
  const cleanup = () => emitter.removeAllListeners()

  const events = { message: 'message', response: 'response' }
  const channel: TinypoolChannel = {
    onMessage: callback => emitter.on(events.message, callback),
    postMessage: message => emitter.emit(events.response, message),
  }

  const rpc = createBirpc<RunnerRPC, RuntimeRPC>(
    createMethodsRPC(project, { cacheFs: true, collect }),
    {
      eventNames: ['onCancel'],
      serialize: (data) => {
        return v8.serialize(data)
      },
      deserialize: v => v8.deserialize(Buffer.from(v)),
      post(v) {
        emitter.emit(events.message, v)
      },
      on(fn) {
        emitter.on(events.response, fn)
      },
      onTimeoutError(functionName) {
        throw new Error(`[vitest-pool]: Timeout calling "${functionName}"`)
      },
    },
  )

  project.ctx.onCancel(reason => rpc.onCancel(reason))

  return { channel, cleanup }
}

export function createVmForksPool(
  ctx: Vitest,
  { execArgv, env }: PoolProcessOptions,
): ProcessPool {
  const numCpus
    = typeof nodeos.availableParallelism === 'function'
      ? nodeos.availableParallelism()
      : nodeos.cpus().length

  const threadsCount = ctx.config.watch
    ? Math.max(Math.floor(numCpus / 2), 1)
    : Math.max(numCpus - 1, 1)

  const poolOptions = ctx.config.poolOptions?.vmForks ?? {}

  const maxThreads
    = poolOptions.maxForks ?? ctx.config.maxWorkers ?? threadsCount
  const minThreads
    = poolOptions.maxForks ?? ctx.config.minWorkers ?? threadsCount

  const worker = resolve(ctx.distPath, 'workers/vmForks.js')

  const options: TinypoolOptions = {
    runtime: 'child_process',
    filename: resolve(ctx.distPath, 'worker.js'),

    maxThreads,
    minThreads,

    env,
    execArgv: [
      '--experimental-import-meta-resolve',
      '--experimental-vm-modules',
      '--require',
      suppressWarningsPath,
      ...(poolOptions.execArgv ?? []),
      ...execArgv,
    ],

    terminateTimeout: ctx.config.teardownTimeout,
    concurrentTasksPerWorker: 1,
    maxMemoryLimitBeforeRecycle: getMemoryLimit(ctx.config) || undefined,
  }

  if (poolOptions.singleFork || !ctx.config.fileParallelism) {
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
      ctx.state.clearFiles(project, paths)

      const { channel, cleanup } = createChildProcessChannel(project, name === 'collect')
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
          ctx.state.addProcessTimeoutCause(
            `Failed to terminate worker while running ${paths.join(', ')}.`,
          )
        }
        // Intentionally cancelled
        else if (
          ctx.isCancelling
          && error instanceof Error
          && /The task has been cancelled/.test(error.message)
        ) {
          ctx.state.cancelFiles(paths, project)
        }
        else {
          throw error
        }
      }
      finally {
        cleanup()
      }
    }

    return async (specs, invalidates) => {
      // Cancel pending tasks from pool when possible
      ctx.onCancel(() => pool.cancelPendingTasks())

      const configs = new Map<TestProject, SerializedConfig>()
      const getConfig = (project: TestProject): SerializedConfig => {
        if (configs.has(project)) {
          return configs.get(project)!
        }

        const _config = project.getSerializableConfig()
        const config = wrapSerializableConfig(_config)

        configs.set(project, config)
        return config
      }

      const filesByEnv = await groupFilesByEnv(specs)
      const promises = Object.values(filesByEnv).flat()
      const results = await Promise.allSettled(
        promises.map(({ file, environment, project }) =>
          runFiles(
            project,
            getConfig(project),
            [file],
            environment,
            invalidates,
          ),
        ),
      )

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
  }

  return {
    name: 'vmForks',
    runTests: runWithFiles('run'),
    collectTests: runWithFiles('collect'),
    close: () => pool.destroy(),
  }
}

function getMemoryLimit(config: ResolvedConfig) {
  const memory = nodeos.totalmem()
  const limit = getWorkerMemoryLimit(config)

  if (typeof memory === 'number') {
    return stringToBytes(limit, config.watch ? memory / 2 : memory)
  }

  // If totalmem is not supported we cannot resolve percentage based values like 0.5, "50%"
  if (
    (typeof limit === 'number' && limit > 1)
    || (typeof limit === 'string' && limit.at(-1) !== '%')
  ) {
    return stringToBytes(limit)
  }

  // just ignore "memoryLimit" value because we cannot detect memory limit
  return null
}
