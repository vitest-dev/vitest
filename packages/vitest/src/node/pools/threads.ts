import { MessageChannel } from 'node:worker_threads'
import { cpus } from 'node:os'
import { pathToFileURL } from 'node:url'
import { createBirpc } from 'birpc'
import { resolve } from 'pathe'
import type { Options as TinypoolOptions } from 'tinypool'
import Tinypool from 'tinypool'
import { distDir } from '../../paths'
import type { ContextTestEnvironment, ResolvedConfig, RuntimeRPC, Vitest, WorkerContext } from '../../types'
import type { PoolProcessOptions, ProcessPool, RunWithFiles } from '../pool'
import { envsOrder, groupFilesByEnv } from '../../utils/test-helpers'
import { groupBy } from '../../utils/base'
import type { VitestWorkspace } from '../workspace'
import { createMethodsRPC } from './rpc'

const workerPath = pathToFileURL(resolve(distDir, './worker.js')).href

function createWorkerChannel(workspace: VitestWorkspace) {
  const channel = new MessageChannel()
  const port = channel.port2
  const workerPort = channel.port1

  createBirpc<{}, RuntimeRPC>(
    createMethodsRPC(workspace),
    {
      post(v) {
        port.postMessage(v)
      },
      on(fn) {
        port.on('message', fn)
      },
    },
  )

  return { workerPort, port }
}

export function createThreadsPool(ctx: Vitest, { execArgv, env }: PoolProcessOptions): ProcessPool {
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
    execArgv,

    terminateTimeout: ctx.config.teardownTimeout,
  }

  if (ctx.config.isolate) {
    options.isolateWorkers = true
    options.concurrentTasksPerWorker = 1
  }

  if (ctx.config.singleThread) {
    options.concurrentTasksPerWorker = 1
    options.maxThreads = 1
    options.minThreads = 1
  }

  const pool = new Tinypool(options)

  const runWithFiles = (name: string): RunWithFiles => {
    let id = 0

    async function runFiles(workspace: VitestWorkspace, config: ResolvedConfig, files: string[], environment: ContextTestEnvironment, invalidates: string[] = []) {
      ctx.state.clearFiles(workspace, files)
      const { workerPort, port } = createWorkerChannel(workspace)
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
      const configs = new Map<VitestWorkspace, ResolvedConfig>()
      const getConfig = (workspace: VitestWorkspace): ResolvedConfig => {
        if (configs.has(workspace))
          return configs.get(workspace)!

        const config = workspace.getSerializableConfig()
        configs.set(workspace, config)
        return config
      }

      const workspaceMap = new Map<string, VitestWorkspace[]>()
      for (const [workspace, file] of specs) {
        const workspaceFiles = workspaceMap.get(file) ?? []
        workspaceFiles.push(workspace)
        workspaceMap.set(file, workspaceFiles)
      }

      // it's possible that workspace defines a file that is also defined by another workspace
      let files = Array.from(new Set(specs.flatMap(([, files]) => files)))
      const { shard } = ctx.config

      if (shard)
        files = await sequencer.shard(files)

      files = await sequencer.sort(files)

      const workspaceFiles = files.flatMap((file) => {
        const workspaces = workspaceMap.get(file)!
        return workspaces.map(workspace => [workspace, file] as const)
      })

      const singleThreads = workspaceFiles.filter(([workspace]) => workspace.config.singleThread)
      const multipleThreads = workspaceFiles.filter(([workspace]) => !workspace.config.singleThread)

      if (multipleThreads.length) {
        const filesByEnv = await groupFilesByEnv(multipleThreads)
        const promises = Object.values(filesByEnv).flat()
        const results = await Promise.allSettled(promises
          .map(({ file, environment, workspace }) => runFiles(workspace, getConfig(workspace), [file], environment, invalidates)))

        const errors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map(r => r.reason)
        if (errors.length > 0)
          throw new AggregateError(errors, 'Errors occurred while running tests. For more information, see serialized error.')
      }

      if (singleThreads.length) {
        const filesByEnv = await groupFilesByEnv(singleThreads)
        const envs = envsOrder.concat(
          Object.keys(filesByEnv).filter(env => !envsOrder.includes(env)),
        )

        // always run environments isolated between each other
        for (const env of envs) {
          const files = filesByEnv[env]

          if (!files?.length)
            continue

          const filesByOptions = groupBy(files, ({ environment }) => JSON.stringify(environment.options))

          for (const option in filesByOptions) {
            const files = filesByOptions[option]
            const filesByWorkspace = groupBy(files, ({ workspace }) => workspace.getName())

            for (const workspace in filesByWorkspace) {
              const files = filesByWorkspace[workspace]

              if (files?.length) {
                const filenames = files.map(f => f.file)
                await runFiles(files[0].workspace, getConfig(files[0].workspace), filenames, files[0].environment, invalidates)
              }
            }
          }
        }
      }
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
