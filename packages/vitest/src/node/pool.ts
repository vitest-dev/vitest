import { MessageChannel } from 'worker_threads'
import { pathToFileURL } from 'url'
import Piscina from 'piscina'
import type { RpcMap } from 'vitest'
import { distDir } from '../constants'
import type { WorkerContext, RpcPayload, File, Awaitable } from '../types'
import { transformRequest } from './transform'
import type { Vitest } from './index'

export type RunWithFiles = (files: string[], invalidates?: string[]) => Promise<void>

export interface WorkerPool {
  runTests: RunWithFiles
  collectTests: RunWithFiles
  close: () => Promise<void>
}

// UPSTREAM: Piscina does not expose this type
interface PiscinaOptions {
  filename?: string | null
  name?: string
  minThreads?: number
  maxThreads?: number
  idleTimeout?: number
  maxQueue?: number | 'auto'
  concurrentTasksPerWorker?: number
  useAtomics?: boolean
}

export function createPool(ctx: Vitest): WorkerPool {
  if (ctx.config.threads)
    return createWorkerPool(ctx)
  else
    return createFakePool(ctx)
}

const workerPath = new URL('./dist/worker.js', pathToFileURL(distDir)).href

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
  const options: PiscinaOptions = {
    filename: workerPath,
    // Disable this for now, for WebContainer capability
    // https://github.com/antfu-sponsors/vitest/issues/93
    // In future we could conditionally enable it based on the env
    useAtomics: false,
  }
  // UPSTREAM: Piscina set defaults by the key existence
  if (ctx.config.maxThreads != null)
    options.maxThreads = ctx.config.maxThreads
  if (ctx.config.minThreads != null)
    options.minThreads = ctx.config.minThreads

  const piscina = new Piscina(options)

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

        await piscina.run(data, { transferList: [workerPort], name })
        port.close()
        workerPort.close()
      }))
    }
  }

  return {
    runTests: runWithFiles('run'),
    collectTests: runWithFiles('collect'),
    close: () => piscina.destroy(),
  }
}

function createChannel(ctx: Vitest) {
  const channel = new MessageChannel()
  const port = channel.port2
  const workerPort = channel.port1

  port.on('message', async({ id, method, args = [] }: RpcPayload) => {
    async function send(fn: () => Awaitable<any>) {
      try {
        port.postMessage({ id, result: await fn() })
      }
      catch (e) {
        port.postMessage({ id, error: e })
      }
    }

    switch (method) {
      case 'processExit':
        process.exit(args[0] as number || 1)
        return
      case 'snapshotSaved':
        return send(() => ctx.snapshot.add(args[0] as any))
      case 'fetch':
        return send(() => transformRequest(ctx.server, ...args as RpcMap['fetch'][0]).then(r => r?.code))
      case 'onCollected':
        ctx.state.collectFiles(args[0] as any)
        ctx.reporters.forEach(r => r.onStart?.((args[0] as any as File[]).map(i => i.filepath)))
        return
      case 'onTaskUpdate':
        ctx.state.updateTasks([args[0] as any])
        ctx.reporters.forEach(r => r.onTaskUpdate?.(args[0] as any))
        return
      case 'log':
        ctx.reporters.forEach(r => r.onUserConsoleLog?.(args[0] as any))
        return
    }

    console.error('Unhandled message', method, args)
  })

  return { workerPort, port }
}
