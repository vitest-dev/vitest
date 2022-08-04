import { MessageChannel } from 'worker_threads'
import _url from 'url'
import { fork } from 'child_process'
import v8 from 'v8'
import { cpus } from 'os'
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

const workerPath = _url.pathToFileURL(resolve(distDir, './worker.mjs')).href
const childPath = _url.pathToFileURL(resolve(distDir, './child.mjs')).pathname
const loaderPath = _url.pathToFileURL(resolve(distDir, './loader.mjs')).href

const suppressLoaderWarningsPath = resolve(rootDir, './suppress-warnings.cjs')

export function createPool(ctx: Vitest): WorkerPool {
  const runFiles = ctx.config.threads ? createWorkerRunner(ctx) : createChildRunner(ctx)

  const Sequencer = ctx.config.sequence.sequencer
  const sequencer = new Sequencer(ctx)

  async function runTests(files: string[], invalidates?: string[]) {
    const config = ctx.getSerializableConfig()

    if (config.shard)
      files = await sequencer.shard(files)

    files = await sequencer.sort(files)

    const results = await Promise.allSettled(files
      .map(file => runFiles(config, [file], invalidates)))

    const errors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map(r => r.reason)
    if (errors.length > 0)
      throw new AggregateError(errors, 'Errors occurred while running tests. For more information, see serialized error.')
  }

  return {
    runTests,
    close: async () => {},
  }
}

function createChildRunner(ctx: Vitest) {
  let id = 0

  async function runFiles(config: ResolvedConfig, files: string[], invalidates: string[] = []) {
    ctx.state.clearFiles(files)
    const { child } = createProcessChannel(ctx)
    const workerId = ++id
    const data: Omit<WorkerContext, 'port'> = {
      config,
      files,
      invalidates,
      workerId,
    }

    return new Promise<void>((resolve, reject) => {
      child.send({ action: 'run', data }, (err) => {
        if (err)
          reject(err)
      })
      function killChild(data: any) {
        if (data && typeof data === 'object' && data.action === 'finished') {
          // child.off('message', killChild)
          resolve()
          // child.unref()
          // child.disconnect()
          // close()
        }
      }
      child.on('message', killChild)
    })
  }

  return runFiles
}

function createWorkerRunner(ctx: Vitest) {
  const threadsCount = ctx.config.watch
    ? Math.max(Math.floor(cpus().length / 2), 1)
    : Math.max(cpus().length - 1, 1)

  const maxThreads = ctx.config.maxThreads ?? threadsCount
  const minThreads = ctx.config.minThreads ?? threadsCount

  const conditions = ctx.server.config.resolve.conditions?.flatMap(c => ['-C', c])

  const options: TinypoolOptions = {
    filename: workerPath,
    // TODO: investigate further
    // It seems atomics introduced V8 Fatal Error https://github.com/vitest-dev/vitest/issues/1191
    useAtomics: false,

    maxThreads,
    minThreads,

    execArgv: ctx.config.deps.registerNodeLoader
      ? [
          '--require',
          suppressLoaderWarningsPath,
          '--experimental-loader',
          loaderPath,
          ...conditions || [],
        ]
      : [],
  }

  if (ctx.config.isolate) {
    options.isolateWorkers = true
    options.concurrentTasksPerWorker = 1
  }

  // if (!ctx.config.threads) {
  //   options.concurrentTasksPerWorker = 1
  //   options.maxThreads = 1
  //   options.minThreads = 1
  // }

  if (ctx.config.coverage.enabled)
    process.env.NODE_V8_COVERAGE ||= ctx.config.coverage.tempDirectory

  options.env = {
    TEST: 'true',
    VITEST: 'true',
    NODE_ENV: ctx.config.mode || 'test',
    VITEST_MODE: ctx.config.watch ? 'WATCH' : 'RUN',
    ...process.env,
    ...ctx.config.env,
  }

  const pool = new Tinypool(options)

  let id = 0

  async function runFiles(config: ResolvedConfig, files: string[], invalidates: string[] = []) {
    ctx.state.clearFiles(files)
    const { workerPort, port } = createWorkerChannel(ctx)
    const workerId = ++id
    const data: WorkerContext = {
      port: workerPort,
      config,
      files,
      invalidates,
      workerId,
    }
    try {
      await pool.run(data, { transferList: [workerPort], name: 'run' })
    }
    finally {
      port.close()
      workerPort.close()
    }
  }

  return runFiles
}

function getRPCObject(ctx: Vitest): WorkerRPC {
  return {
    onWorkerExit(code) {
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
    onTaskUpdate(packs) {
      ctx.state.updateTasks(packs)
      ctx.report('onTaskUpdate', packs)
    },
    onUserConsoleLog(log) {
      ctx.state.updateUserLog(log)
      ctx.report('onUserConsoleLog', log)
    },
    onUnhandledRejection(err) {
      ctx.state.catchError(err, 'Unhandled Rejection')
    },
    onFinished(files) {
      ctx.report('onFinished', files, ctx.state.getUnhandledErrors())
    },
  }
}

function createWorkerChannel(ctx: Vitest) {
  const channel = new MessageChannel()
  const port = channel.port2
  const workerPort = channel.port1

  createBirpc<{}, WorkerRPC>(
    getRPCObject(ctx),
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

function createProcessChannel(ctx: Vitest) {
  const controller = typeof AbortController != 'undefined' ? new AbortController() : { signal: undefined }
  const child = fork(childPath, [], {
    detached: true,
    signal: controller.signal,
    env: {
      TEST: 'true',
      VITEST: 'true',
      NODE_ENV: ctx.config.mode || 'test',
      VITEST_MODE: ctx.config.watch ? 'WATCH' : 'RUN',
      ...process.env,
      ...ctx.config.env,
    },
  })

  createBirpc<{}, WorkerRPC>(
    getRPCObject(ctx),
    {
      post(v) {
        child.send(v8.serialize(v))
      },
      on(fn) {
        child.on('message', (data: any) => {
          if (data.type === 'Buffer')
            return fn(v8.deserialize(Buffer.from(data.data)))

          return fn(data)
        })
      },
    },
  )

  const close = () => {
    if (controller.signal)
      controller.abort()
    else
      child.kill()
  }

  return { child, close }
}
