import { MessageChannel } from 'node:worker_threads'
import { cpus } from 'node:os'
import { pathToFileURL } from 'node:url'
import { createBirpc } from 'birpc'
import { resolve } from 'pathe'
import type { Options as TinypoolOptions } from 'tinypool'
import Tinypool from 'tinypool'
import { distDir, rootDir } from '../../paths'
import type { ContextTestEnvironment, ResolvedConfig, RunnerRPC, RuntimeRPC, Vitest, WorkerContext } from '../../types'
import type { PoolProcessOptions, ProcessPool, RunWithFiles } from '../pool'
import { groupFilesByEnv } from '../../utils/test-helpers'
import { AggregateError } from '../../utils/base'
import type { WorkspaceProject } from '../workspace'
import { createMethodsRPC } from './rpc'

const workerPath = pathToFileURL(resolve(distDir, './vm.js')).href
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

export function createVmThreadsPool(ctx: Vitest, { execArgv, env }: PoolProcessOptions): ProcessPool {
  const threadsCount = ctx.config.watch
    ? Math.max(Math.floor(cpus().length / 2), 1)
    : Math.max(cpus().length - 1, 1)

  const maxThreads = ctx.config.maxThreads ?? threadsCount
  const minThreads = ctx.config.minThreads ?? threadsCount

  const options: TinypoolOptions = {
    filename: workerPath,
    // TODO: investigate further
    // It seems atomics introduced V8 Fatal Error https://github.com/vitest-dev/vitest/issues/1191
    useAtomics: ctx.config.useAtomics ?? false,

    maxThreads,
    minThreads,

    env,
    execArgv: [
      '--experimental-import-meta-resolve',
      '--experimental-vm-modules',
      '--require',
      suppressWarningsPath,
      ...execArgv,
    ],

    terminateTimeout: ctx.config.teardownTimeout,
    maxMemoryLimitBeforeRecycle: ctx.config.experimentalVmWorkerMemoryLimit || undefined,
  }

  if (ctx.config.singleThread) {
    options.concurrentTasksPerWorker = 1
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
          ctx.state.cancelFiles(files, ctx.config.root)

        else
          throw error
      }
      finally {
        port.close()
        workerPort.close()
      }
    }

    const Sequencer = ctx.config.sequence.sequencer
    const sequencer = new Sequencer(ctx)

    return async (specs, invalidates) => {
      const configs = new Map<WorkspaceProject, ResolvedConfig>()
      const getConfig = (project: WorkspaceProject): ResolvedConfig => {
        if (configs.has(project))
          return configs.get(project)!

        const config = project.getSerializableConfig()
        configs.set(project, config)
        return config
      }

      const { shard } = ctx.config

      if (shard)
        specs = await sequencer.shard(specs)

      specs = await sequencer.sort(specs)

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
    runTests: runWithFiles('run'),
    close: async () => {
      // node before 16.17 has a bug that causes FATAL ERROR because of the race condition
      const nodeVersion = Number(process.version.match(/v(\d+)\.(\d+)/)?.[0].slice(1))
      if (nodeVersion >= 16.17)
        await pool.destroy()
    },
  }
}
