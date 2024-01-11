import { MessageChannel } from 'node:worker_threads'
import * as nodeos from 'node:os'
import { createBirpc } from 'birpc'
import type { Options as TinypoolOptions } from 'tinypool'
import Tinypool from 'tinypool'
import type { ContextTestEnvironment, ResolvedConfig, RunnerRPC, RuntimeRPC, Vitest, WorkerContext } from '../../types'
import type { PoolProcessOptions, ProcessPool, RunWithFiles } from '../pool'
import { envsOrder, groupFilesByEnv } from '../../utils/test-helpers'
import { AggregateError, groupBy } from '../../utils/base'
import type { WorkspaceProject } from '../workspace'
import { createMethodsRPC } from './rpc'

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

export function createThreadsPool(ctx: Vitest, { execArgv, env, workerPath }: PoolProcessOptions): ProcessPool {
  const numCpus
    = typeof nodeos.availableParallelism === 'function'
      ? nodeos.availableParallelism()
      : nodeos.cpus().length

  const threadsCount = ctx.config.watch
    ? Math.max(Math.floor(numCpus / 2), 1)
    : Math.max(numCpus - 1, 1)

  const poolOptions = ctx.config.poolOptions?.threads ?? {}

  const maxThreads = poolOptions.maxThreads ?? ctx.config.maxWorkers ?? threadsCount
  const minThreads = poolOptions.minThreads ?? ctx.config.minWorkers ?? threadsCount

  const options: TinypoolOptions = {
    filename: workerPath,
    // TODO: investigate further
    // It seems atomics introduced V8 Fatal Error https://github.com/vitest-dev/vitest/issues/1191
    useAtomics: poolOptions.useAtomics ?? false,

    maxThreads,
    minThreads,

    env,
    execArgv: [
      ...poolOptions.execArgv ?? [],
      ...execArgv,
    ],

    terminateTimeout: ctx.config.teardownTimeout,
    concurrentTasksPerWorker: 1,
  }

  const isolated = poolOptions.isolate ?? true

  if (isolated)
    options.isolateWorkers = true

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

      const workspaceMap = new Map<string, WorkspaceProject[]>()
      for (const [project, file] of specs) {
        const workspaceFiles = workspaceMap.get(file) ?? []
        workspaceFiles.push(project)
        workspaceMap.set(file, workspaceFiles)
      }

      const singleThreads = specs.filter(([project]) => project.config.poolOptions?.threads?.singleThread)
      const multipleThreads = specs.filter(([project]) => !project.config.poolOptions?.threads?.singleThread)

      if (multipleThreads.length) {
        const filesByEnv = await groupFilesByEnv(multipleThreads)
        const files = Object.values(filesByEnv).flat()
        const results: PromiseSettledResult<void>[] = []

        if (isolated) {
          results.push(...await Promise.allSettled(files.map(({ file, environment, project }) =>
            runFiles(project, getConfig(project), [file], environment, invalidates))))
        }
        else {
          // When isolation is disabled, we still need to isolate environments and workspace projects from each other.
          // Tasks are still running parallel but environments are isolated between tasks.
          const grouped = groupBy(files, ({ project, environment }) => project.getName() + environment.name + JSON.stringify(environment.options))

          for (const group of Object.values(grouped)) {
            // Push all files to pool's queue
            results.push(...await Promise.allSettled(group.map(({ file, environment, project }) =>
              runFiles(project, getConfig(project), [file], environment, invalidates))))

            // Once all tasks are running or finished, recycle worker for isolation.
            // On-going workers will run in the previous environment.
            await new Promise<void>(resolve => pool.queueSize === 0 ? resolve() : pool.once('drain', resolve))
            await pool.recycleWorkers()
          }
        }

        const errors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map(r => r.reason)
        if (errors.length > 0)
          throw new AggregateError(errors, 'Errors occurred while running tests. For more information, see serialized error.')
      }

      if (singleThreads.length) {
        const filesByEnv = await groupFilesByEnv(singleThreads)
        const envs = envsOrder.concat(
          Object.keys(filesByEnv).filter(env => !envsOrder.includes(env)),
        )

        for (const env of envs) {
          const files = filesByEnv[env]

          if (!files?.length)
            continue

          const filesByOptions = groupBy(files, ({ project, environment }) => project.getName() + JSON.stringify(environment.options))

          for (const files of Object.values(filesByOptions)) {
            // Always run environments isolated between each other
            await pool.recycleWorkers()

            const filenames = files.map(f => f.file)
            await runFiles(files[0].project, getConfig(files[0].project), filenames, files[0].environment, invalidates)
          }
        }
      }
    }
  }

  return {
    name: 'threads',
    runTests: runWithFiles('run'),
    close: async () => {
      // node before 16.17 has a bug that causes FATAL ERROR because of the race condition
      const nodeVersion = Number(process.version.match(/v(\d+)\.(\d+)/)?.[0].slice(1))
      if (nodeVersion >= 16.17)
        await pool.destroy()
    },
  }
}
