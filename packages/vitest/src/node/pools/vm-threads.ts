import { MessageChannel } from 'node:worker_threads'
import * as nodeos from 'node:os'
import { createBirpc } from 'birpc'
import { resolve } from 'pathe'
import type { Options as TinypoolOptions } from 'tinypool'
import Tinypool from 'tinypool'
import { rootDir } from '../../paths'
import type { ContextTestEnvironment, ResolvedConfig, RunnerRPC, RuntimeRPC, Vitest, WorkerContext } from '../../types'
import type { PoolProcessOptions, ProcessPool, RunWithFiles } from '../pool'
import { groupFilesByEnv } from '../../utils/test-helpers'
import { AggregateError } from '../../utils/base'
import type { WorkspaceProject } from '../workspace'
import { getWorkerMemoryLimit, stringToBytes } from '../../utils/memory-limit'
import { createMethodsRPC } from './rpc'

const suppressWarningsPath = resolve(rootDir, './suppress-warnings.cjs')

function createWorkerChannel(project: WorkspaceProject) {
  const channel = new MessageChannel()
  const port = channel.port2
  const workerPort = channel.port1

  const rpc = createBirpc<RunnerRPC, RuntimeRPC>(
    createMethodsRPC(project),
    {
      eventNames: ['onCancel'],
      post(v) {
        port.postMessage(v)
      },
      on(fn) {
        port.on('message', fn)
      },
    },
  )

  project.ctx.onCancel(reason => rpc.onCancel(reason))

  return { workerPort, port }
}

export function createVmThreadsPool(ctx: Vitest, { execArgv, env, vmPath }: PoolProcessOptions): ProcessPool {
  const numCpus
    = typeof nodeos.availableParallelism === 'function'
      ? nodeos.availableParallelism()
      : nodeos.cpus().length

  const threadsCount = ctx.config.watch
    ? Math.max(Math.floor(numCpus / 2), 1)
    : Math.max(numCpus - 1, 1)

  const poolOptions = ctx.config.poolOptions?.vmThreads ?? {}

  const maxThreads = poolOptions.maxThreads ?? ctx.config.maxWorkers ?? threadsCount
  const minThreads = poolOptions.minThreads ?? ctx.config.minWorkers ?? threadsCount

  const options: TinypoolOptions = {
    filename: vmPath,
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
      ...poolOptions.execArgv ?? [],
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

    async function runFiles(project: WorkspaceProject, config: ResolvedConfig, files: string[], environment: ContextTestEnvironment, invalidates: string[] = []) {
      ctx.state.clearFiles(project, files)
      const { workerPort, port } = createWorkerChannel(project)
      const workerId = ++id
      const data: WorkerContext = {
        port: workerPort,
        config,
        files,
        invalidates,
        environment,
        workerId,
        projectName: project.getName(),
        providedContext: project.getProvidedContext(),
      }
      try {
        await pool.run(data, { transferList: [workerPort], name })
      }
      catch (error) {
        // Worker got stuck and won't terminate - this may cause process to hang
        if (error instanceof Error && /Failed to terminate worker/.test(error.message))
          ctx.state.addProcessTimeoutCause(`Failed to terminate worker while running ${files.join(', ')}.`)

        // Intentionally cancelled
        else if (ctx.isCancelling && error instanceof Error && /The task has been cancelled/.test(error.message))
          ctx.state.cancelFiles(files, ctx.config.root, project.config.name)

        else
          throw error
      }
      finally {
        port.close()
        workerPort.close()
      }
    }

    return async (specs, invalidates) => {
      // Cancel pending tasks from pool when possible
      ctx.onCancel(() => pool.cancelPendingTasks())

      const configs = new Map<WorkspaceProject, ResolvedConfig>()
      const getConfig = (project: WorkspaceProject): ResolvedConfig => {
        if (configs.has(project))
          return configs.get(project)!

        const config = project.getSerializableConfig()
        configs.set(project, config)
        return config
      }

      const filesByEnv = await groupFilesByEnv(specs)
      const promises = Object.values(filesByEnv).flat()
      const results = await Promise.allSettled(promises
        .map(({ file, environment, project }) => runFiles(project, getConfig(project), [file], environment, invalidates)))

      const errors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map(r => r.reason)
      if (errors.length > 0)
        throw new AggregateError(errors, 'Errors occurred while running tests. For more information, see serialized error.')
    }
  }

  return {
    name: 'vmThreads',
    runTests: runWithFiles('run'),
    close: async () => {
      // node before 16.17 has a bug that causes FATAL ERROR because of the race condition
      const nodeVersion = Number(process.version.match(/v(\d+)\.(\d+)/)?.[0].slice(1))
      if (nodeVersion >= 16.17)
        await pool.destroy()
    },
  }
}

function getMemoryLimit(config: ResolvedConfig) {
  const memory = nodeos.totalmem()
  const limit = getWorkerMemoryLimit(config)

  if (typeof memory === 'number') {
    return stringToBytes(
      limit,
      config.watch ? memory / 2 : memory,
    )
  }

  // If totalmem is not supported we cannot resolve percentage based values like 0.5, "50%"
  if ((typeof limit === 'number' && limit > 1) || (typeof limit === 'string' && limit.at(-1) !== '%'))
    return stringToBytes(limit)

  // just ignore "memoryLimit" value because we cannot detect memory limit
  return null
}
