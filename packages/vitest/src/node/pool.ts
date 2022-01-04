import { MessageChannel } from 'worker_threads'
import { pathToFileURL } from 'url'
import { cpus } from 'os'
import { resolve } from 'pathe'
import type { Options as TinypoolOptions } from 'tinypool'
import { Tinypool } from 'tinypool'
import type { RawSourceMap } from 'source-map-js'
import { createBirpc } from 'birpc'
import { distDir } from '../constants'
import type { WorkerContext, WorkerRPC } from '../types'
import { transformRequest } from './transform'
import type { Vitest } from './index'

export type RunWithFiles = (files: string[], invalidates?: string[]) => Promise<void>

export interface WorkerPool {
  runTests: RunWithFiles
  collectTests: RunWithFiles
  close: () => Promise<void>
}

export function createPool(ctx: Vitest): WorkerPool {
  if (ctx.config.threads)
    return createWorkerPool(ctx)
  else
    return createFakePool(ctx)
}

const workerPath = pathToFileURL(resolve(distDir, './worker.js')).href

export function createFakePool(ctx: Vitest): WorkerPool {
  const runWithFiles = (name: 'run' | 'collect'): RunWithFiles => {
    return async(files, invalidates) => {
      const worker = await import(workerPath)

      const { workerPort, port } = createChannel(ctx)

      const data: WorkerContext = {
        port: workerPort,
        config: ctx.config,
        files,
        invalidates,
      }

      await worker[name](data, { transferList: [workerPort] })

      port.close()
      workerPort.close()
    }
  }

  return {
    runTests: runWithFiles('run'),
    collectTests: runWithFiles('collect'),
    close: async() => {},
  }
}

export function createWorkerPool(ctx: Vitest): WorkerPool {
  const options: TinypoolOptions = {
    filename: workerPath,
    // Disable this for now, for WebContainer capability
    // https://github.com/vitest-dev/vitest/issues/93
    // In future we could conditionally enable it based on the env
    useAtomics: false,
  }
  if (ctx.config.isolate) {
    options.isolateWorkers = true
    options.concurrentTasksPerWorker = 1
  }

  const cpuCount = cpus().length
  options.minThreads = ctx.config.minThreads ?? Math.max(cpuCount / 2, 1)
  options.maxThreads = ctx.config.maxThreads ?? cpuCount

  const pool = new Tinypool(options)

  const runWithFiles = (name: string): RunWithFiles => {
    return async(files, invalidates) => {
      await Promise.all(files.map(async(file) => {
        const { workerPort, port } = createChannel(ctx)

        const data: WorkerContext = {
          port: workerPort,
          config: ctx.config,
          files: [file],
          invalidates,
        }

        await pool.run(data, { transferList: [workerPort], name })
        port.close()
        workerPort.close()
      }))
    }
  }

  return {
    runTests: runWithFiles('run'),
    collectTests: runWithFiles('collect'),
    close: async() => {}, // TODO: not sure why this will cause Node crash: pool.destroy(),
  }
}

function createChannel(ctx: Vitest) {
  const channel = new MessageChannel()
  const port = channel.port2
  const workerPort = channel.port1

  createBirpc<WorkerRPC>({
    functions: {
      onWorkerExit(code) {
        process.exit(code || 1)
      },
      snapshotSaved(snapshot) {
        ctx.snapshot.add(snapshot)
      },
      async getSourceMap(id, force) {
        if (force) {
          const mod = ctx.server.moduleGraph.getModuleById(id)
          if (mod)
            ctx.server.moduleGraph.invalidateModule(mod)
        }
        const r = await transformRequest(ctx, id)
        return r?.map as RawSourceMap | undefined
      },
      async fetch(id) {
        const r = await transformRequest(ctx, id)
        return r?.code
      },
      onCollected(files) {
        ctx.state.collectFiles(files)
        ctx.report('onCollected', files)
      },
      onTaskUpdate(packs) {
        ctx.state.updateTasks(packs)
        ctx.report('onTaskUpdate', packs)
      },
      onUserLog(msg) {
        ctx.report('onUserConsoleLog', msg)
      },
    },
    post(v) {
      port.postMessage(v)
    },
    on(fn) {
      port.on('message', fn)
    },
  })

  return { workerPort, port }
}
