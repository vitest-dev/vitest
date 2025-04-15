import type { FileSpecification } from '@vitest/runner'
import type { Options as TinypoolOptions } from 'tinypool'
import type { RunnerRPC, RuntimeRPC } from '../../types/rpc'
import type { ContextTestEnvironment } from '../../types/worker'
import type { Vitest } from '../core'
import type { PoolProcessOptions, ProcessPool, RunWithFiles } from '../pool'
import type { TestProject } from '../project'
import type { ResolvedConfig, SerializedConfig } from '../types/config'
import type { WorkerContext } from '../types/worker'
import * as nodeos from 'node:os'
import { resolve } from 'node:path'
import { MessageChannel } from 'node:worker_threads'
import { createBirpc } from 'birpc'
import Tinypool from 'tinypool'
import { rootDir } from '../../paths'
import { getWorkerMemoryLimit, stringToBytes } from '../../utils/memory-limit'
import { groupFilesByEnv } from '../../utils/test-helpers'
import { createMethodsRPC } from './rpc'

const suppressWarningsPath = resolve(rootDir, './suppress-warnings.cjs')

function createWorkerChannel(project: TestProject, collect: boolean) {
  const channel = new MessageChannel()
  const port = channel.port2
  const workerPort = channel.port1

  const rpc = createBirpc<RunnerRPC, RuntimeRPC>(createMethodsRPC(project, { collect }), {
    eventNames: ['onCancel'],
    post(v) {
      port.postMessage(v)
    },
    on(fn) {
      port.on('message', fn)
    },
    onTimeoutError(functionName) {
      throw new Error(`[vitest-pool]: Timeout calling "${functionName}"`)
    },
  })

  project.ctx.onCancel(reason => rpc.onCancel(reason))

  return { workerPort, port }
}

export function createVmThreadsPool(
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

  const poolOptions = ctx.config.poolOptions?.vmThreads ?? {}

  const maxThreads
    = poolOptions.maxThreads ?? ctx.config.maxWorkers ?? threadsCount
  const minThreads
    = poolOptions.minThreads ?? ctx.config.minWorkers ?? threadsCount

  const worker = resolve(ctx.distPath, 'workers/vmThreads.js')

  const options: TinypoolOptions = {
    filename: resolve(ctx.distPath, 'worker.js'),
    // TODO: investigate further
    // It seems atomics introduced V8 Fatal Error https://github.com/vitest-dev/vitest/issues/1191
    useAtomics: poolOptions.useAtomics ?? false,

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

  if (poolOptions.singleThread || !ctx.config.fileParallelism) {
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

      const { workerPort, port } = createWorkerChannel(project, name === 'collect')
      const workerId = ++id
      const data: WorkerContext = {
        pool: 'vmThreads',
        worker,
        port: workerPort,
        config,
        files: paths,
        invalidates,
        environment,
        workerId,
        projectName: project.name,
        providedContext: project.getProvidedContext(),
      }
      try {
        await pool.run(data, { transferList: [workerPort], name })
      }
      catch (error) {
        // Worker got stuck and won't terminate - this may cause process to hang
        if (
          error instanceof Error
          && /Failed to terminate worker/.test(error.message)
        ) {
          ctx.state.addProcessTimeoutCause(
            `Failed to terminate worker while running ${paths.join(
              ', ',
            )}. \nSee https://vitest.dev/guide/common-errors.html#failed-to-terminate-worker for troubleshooting.`,
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
        port.close()
        workerPort.close()
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

        const config = project.serializedConfig
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
    name: 'vmThreads',
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
