import { MessageChannel } from 'node:worker_threads'
import { cpus } from 'node:os'
import { pathToFileURL } from 'node:url'
import { createBirpc } from 'birpc'
import { resolve } from 'pathe'
import type { Options as TinypoolOptions } from 'tinypool'
import Tinypool from 'tinypool'
import { distDir } from '../../constants'
import type { ContextTestEnvironment, ResolvedConfig, RuntimeRPC, WorkerContext } from '../../types'
import type { Vitest } from '../core'
import type { PoolProcessOptions, ProcessPool, RunWithFiles } from '../pool'
import { envsOrder, groupFilesByEnv } from '../../utils/test-helpers'
import { groupBy } from '../../utils/base'
import { createMethodsRPC } from './rpc'

const workerPath = pathToFileURL(resolve(distDir, './worker.js')).href

function createWorkerChannel(ctx: Vitest) {
  const channel = new MessageChannel()
  const port = channel.port2
  const workerPort = channel.port1

  createBirpc<{}, RuntimeRPC>(
    createMethodsRPC(ctx),
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

    async function runFiles(config: ResolvedConfig, files: string[], environment: ContextTestEnvironment, invalidates: string[] = []) {
      ctx.state.clearFiles(files)
      const { workerPort, port } = createWorkerChannel(ctx)
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
      finally {
        port.close()
        workerPort.close()
      }
    }

    const Sequencer = ctx.config.sequence.sequencer
    const sequencer = new Sequencer(ctx)

    return async (files, invalidates) => {
      const config = ctx.getSerializableConfig()

      if (config.shard)
        files = await sequencer.shard(files)

      files = await sequencer.sort(files)

      const filesByEnv = await groupFilesByEnv(files, config)
      const envs = envsOrder.concat(
        Object.keys(filesByEnv).filter(env => !envsOrder.includes(env)),
      )

      if (ctx.config.singleThread) {
        // always run environments isolated between each other
        for (const env of envs) {
          const files = filesByEnv[env]

          if (!files?.length)
            continue

          const filesByOptions = groupBy(files, ({ environment }) => JSON.stringify(environment.options))

          for (const option in filesByOptions) {
            const files = filesByOptions[option]

            if (files?.length) {
              const filenames = files.map(f => f.file)
              await runFiles(config, filenames, files[0].environment, invalidates)
            }
          }
        }
      }
      else {
        const promises = Object.values(filesByEnv).flat()
        const results = await Promise.allSettled(promises
          .map(({ file, environment }) => runFiles(config, [file], environment, invalidates)))

        const errors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map(r => r.reason)
        if (errors.length > 0)
          throw new AggregateError(errors, 'Errors occurred while running tests. For more information, see serialized error.')
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
