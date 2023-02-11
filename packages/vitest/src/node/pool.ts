import { MessageChannel } from 'node:worker_threads'
import _url from 'node:url'
import { cpus } from 'node:os'
import { resolve } from 'pathe'
import type { Options as TinypoolOptions } from 'tinypool'
import { Tinypool } from 'tinypool'
import { createBirpc } from 'birpc'
import type { RawSourceMap } from 'vite-node'
import type { ResolvedConfig, WorkerContext, WorkerRPC } from '../types'
import { distDir, rootDir } from '../constants'
import { AggregateError } from '../utils'
import type { Vitest } from './core'

export type RunWithFiles = (files: string[], invalidates?: string[]) => Promise<void>

export interface WorkerPool {
  runTests: RunWithFiles
  close: () => Promise<void>
}

const workerPath = _url.pathToFileURL(resolve(distDir, './worker.js')).href
const loaderPath = _url.pathToFileURL(resolve(distDir, './loader.js')).href

const suppressLoaderWarningsPath = resolve(rootDir, './suppress-warnings.cjs')

export function createPool(ctx: Vitest): WorkerPool {
  const threadsCount = ctx.config.watch
    ? Math.max(Math.floor(cpus().length / 2), 1)
    : Math.max(cpus().length - 1, 1)

  const maxThreads = ctx.config.maxThreads ?? threadsCount
  const minThreads = ctx.config.minThreads ?? threadsCount

  const conditions = ctx.server.config.resolve.conditions?.flatMap(c => ['--conditions', c]) || []

  // Instead of passing whole process.execArgv to the workers, pick allowed options.
  // Some options may crash worker, e.g. --prof, --title. nodejs/node#41103
  const execArgv = process.execArgv.filter(execArg =>
    execArg.startsWith('--cpu-prof') || execArg.startsWith('--heap-prof'),
  )

  const options: TinypoolOptions = {
    filename: workerPath,
    // TODO: investigate further
    // It seems atomics introduced V8 Fatal Error https://github.com/vitest-dev/vitest/issues/1191
    useAtomics: ctx.config.useAtomics ?? false,

    maxThreads,
    minThreads,

    execArgv: ctx.config.deps.registerNodeLoader
      ? [
          ...execArgv,
          '--require',
          suppressLoaderWarningsPath,
          '--experimental-loader',
          loaderPath,
          ...conditions,
        ]
      : [
          ...execArgv,
          ...conditions,
        ],
  }

  if (ctx.config.isolate) {
    options.isolateWorkers = true
    options.concurrentTasksPerWorker = 1
  }

  if (!ctx.config.threads) {
    options.concurrentTasksPerWorker = 1
    options.maxThreads = 1
    options.minThreads = 1
  }

  ctx.coverageProvider?.onBeforeFilesRun?.()

  options.env = {
    TEST: 'true',
    VITEST: 'true',
    NODE_ENV: ctx.config.mode || 'test',
    VITEST_MODE: ctx.config.watch ? 'WATCH' : 'RUN',
    ...process.env,
    ...ctx.config.env,
  }

  const pool = new Tinypool(options)

  const runWithFiles = (name: string): RunWithFiles => {
    let id = 0

    async function runFiles(config: ResolvedConfig, files: string[], invalidates: string[] = []) {
      ctx.state.clearFiles(files)
      const { workerPort, port } = createChannel(ctx)
      const workerId = ++id
      const data: WorkerContext = {
        port: workerPort,
        config,
        files,
        invalidates,
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

      if (!ctx.config.threads) {
        await runFiles(config, files)
      }
      else {
        const results = await Promise.allSettled(files
          .map(file => runFiles(config, [file], invalidates)))

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

function createChannel(ctx: Vitest) {
  const channel = new MessageChannel()
  const port = channel.port2
  const workerPort = channel.port1

  createBirpc<{}, WorkerRPC>(
    {
      async onWorkerExit(error, code) {
        await ctx.logger.printError(error, false, 'Unexpected Exit')
        process.exit(code || 1)
      },
      snapshotSaved(snapshot) {
        ctx.snapshot.add(snapshot)
      },
      resolveSnapshotPath(testPath: string) {
        return ctx.snapshot.resolvePath(testPath)
      },
      async getSourceMap(id, force) {
        if (force) {
          const mod = ctx.server.moduleGraph.getModuleById(id)
          if (mod)
            ctx.server.moduleGraph.invalidateModule(mod)
        }
        const r = await ctx.vitenode.transformRequest(id)
        return r?.map as RawSourceMap | undefined
      },
      fetch(id) {
        return ctx.vitenode.fetchModule(id)
      },
      resolveId(id, importer) {
        return ctx.vitenode.resolveId(id, importer)
      },
      onPathsCollected(paths) {
        ctx.state.collectPaths(paths)
        ctx.report('onPathsCollected', paths)
      },
      onCollected(files) {
        ctx.state.collectFiles(files)
        ctx.report('onCollected', files)
      },
      onAfterSuiteRun(meta) {
        ctx.coverageProvider?.onAfterSuiteRun(meta)
      },
      onTaskUpdate(packs) {
        ctx.state.updateTasks(packs)
        ctx.report('onTaskUpdate', packs)
      },
      onUserConsoleLog(log) {
        ctx.state.updateUserLog(log)
        ctx.report('onUserConsoleLog', log)
      },
      onUnhandledError(err, type) {
        ctx.state.catchError(err, type)
      },
      onFinished(files) {
        ctx.report('onFinished', files, ctx.state.getUnhandledErrors())
      },
    },
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
