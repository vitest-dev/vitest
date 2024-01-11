import v8 from 'node:v8'
import * as nodeos from 'node:os'
import EventEmitter from 'node:events'
import { Tinypool } from 'tinypool'
import type { TinypoolChannel, Options as TinypoolOptions } from 'tinypool'
import { createBirpc } from 'birpc'
import type { ContextTestEnvironment, ResolvedConfig, RunnerRPC, RuntimeRPC, Vitest } from '../../types'
import type { ChildContext } from '../../types/child'
import type { PoolProcessOptions, ProcessPool, RunWithFiles } from '../pool'
import type { WorkspaceProject } from '../workspace'
import { envsOrder, groupFilesByEnv } from '../../utils/test-helpers'
import { groupBy } from '../../utils'
import { createMethodsRPC } from './rpc'

function createChildProcessChannel(project: WorkspaceProject) {
  const emitter = new EventEmitter()
  const cleanup = () => emitter.removeAllListeners()

  const events = { message: 'message', response: 'response' }
  const channel: TinypoolChannel = {
    onMessage: callback => emitter.on(events.message, callback),
    postMessage: message => emitter.emit(events.response, message),
  }

  const rpc = createBirpc<RunnerRPC, RuntimeRPC>(
    createMethodsRPC(project),
    {
      eventNames: ['onCancel'],
      serialize: v8.serialize,
      deserialize: v => v8.deserialize(Buffer.from(v)),
      post(v) {
        emitter.emit(events.message, v)
      },
      on(fn) {
        emitter.on(events.response, fn)
      },
    },
  )

  project.ctx.onCancel(reason => rpc.onCancel(reason))

  return { channel, cleanup }
}

function stringifyRegex(input: RegExp | string): string {
  if (typeof input === 'string')
    return input
  return `$$vitest:${input.toString()}`
}

export function createChildProcessPool(ctx: Vitest, { execArgv, env, forksPath }: PoolProcessOptions): ProcessPool {
  const numCpus
    = typeof nodeos.availableParallelism === 'function'
      ? nodeos.availableParallelism()
      : nodeos.cpus().length

  const threadsCount = ctx.config.watch
    ? Math.max(Math.floor(numCpus / 2), 1)
    : Math.max(numCpus - 1, 1)

  const poolOptions = ctx.config.poolOptions?.forks ?? {}

  const maxThreads = poolOptions.maxForks ?? ctx.config.maxWorkers ?? threadsCount
  const minThreads = poolOptions.minForks ?? ctx.config.minWorkers ?? threadsCount

  const options: TinypoolOptions = {
    runtime: 'child_process',
    filename: forksPath,

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

  if (poolOptions.singleFork || !ctx.config.fileParallelism) {
    options.maxThreads = 1
    options.minThreads = 1
  }

  const pool = new Tinypool(options)

  const runWithFiles = (name: string): RunWithFiles => {
    let id = 0

    async function runFiles(project: WorkspaceProject, config: ResolvedConfig, files: string[], environment: ContextTestEnvironment, invalidates: string[] = []) {
      ctx.state.clearFiles(project, files)
      const { channel, cleanup } = createChildProcessChannel(project)
      const workerId = ++id
      const data: ChildContext = {
        config,
        files,
        invalidates,
        environment,
        workerId,
        projectName: project.getName(),
        providedContext: project.getProvidedContext(),
      }
      try {
        await pool.run(data, { name, channel })
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
        cleanup()
      }
    }

    return async (specs, invalidates) => {
      // Cancel pending tasks from pool when possible
      ctx.onCancel(() => pool.cancelPendingTasks())

      const configs = new Map<WorkspaceProject, ResolvedConfig>()
      const getConfig = (project: WorkspaceProject): ResolvedConfig => {
        if (configs.has(project))
          return configs.get(project)!

        const _config = project.getSerializableConfig()

        const config = {
          ..._config,
          // v8 serialize does not support regex
          testNamePattern: _config.testNamePattern
            ? stringifyRegex(_config.testNamePattern)
            : undefined,
        } as ResolvedConfig

        configs.set(project, config)
        return config
      }

      const workspaceMap = new Map<string, WorkspaceProject[]>()
      for (const [project, file] of specs) {
        const workspaceFiles = workspaceMap.get(file) ?? []
        workspaceFiles.push(project)
        workspaceMap.set(file, workspaceFiles)
      }

      const singleFork = specs.filter(([project]) => project.config.poolOptions?.forks?.singleFork)
      const multipleForks = specs.filter(([project]) => !project.config.poolOptions?.forks?.singleFork)

      if (multipleForks.length) {
        const filesByEnv = await groupFilesByEnv(multipleForks)
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

      if (singleFork.length) {
        const filesByEnv = await groupFilesByEnv(singleFork)
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
    name: 'forks',
    runTests: runWithFiles('run'),
    close: async () => {
      await pool.destroy()
    },
  }
}
