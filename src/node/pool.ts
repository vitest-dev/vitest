import { MessageChannel } from 'worker_threads'
import { pathToFileURL } from 'url'
import Piscina from 'piscina'
import { Awaitable } from '@antfu/utils'
import { RpcMap } from 'vitest'
import { nanoid } from 'nanoid'
import { distDir } from '../constants'
import { WorkerContext, RpcMessage, VitestContext, WorkerInstance } from '../types'
import { transformRequest } from './transform'

export interface WorkerPool {
  workers: WorkerInstance[]
  runTestFiles: (files: string[]) => Promise<void>
  close: () => Promise<void>
}

export function createWorkerPool(size: number, ctx: VitestContext): WorkerPool {
  const workers = new Array(size).fill(0).map(() => createWorker(ctx))

  async function runTestFiles(files: string[]) {
    const _tasks = [...files]
    await Promise.all(workers.map(async(worker) => {
      await worker.init()
      while (_tasks.length) {
        const i = _tasks.pop()
        if (i)
          await worker.run([i])
        else
          break
      }
    }))
  }

  async function close() {
    await Promise.all(workers.map(async(worker) => {
      await worker.close()
    }))
  }

  return {
    workers,
    runTestFiles,
    close,
  }
}

export function createWorker(ctx: VitestContext) {
  const piscina = new Piscina({
    filename: new URL('./dist/node/worker.js', pathToFileURL(distDir)).href,
    useAtomics: false,
  })

  const channel = new MessageChannel()
  const port = channel.port1

  const instance: WorkerInstance = {
    id: nanoid(),
    state: 'init',
    port,
    promise: null,
    async init() {
      if (instance.state !== 'init')
        return
      const meta: WorkerContext = { port: channel.port2, config: ctx.config }
      await piscina.run(meta, { transferList: [channel.port2], name: 'init' })
      this.state = 'idle'
    },
    async run(files: string[]) {
      if (this.promise)
        await this.promise

      this.state = 'run'
      this.promise = piscina.run(files, { name: 'run' })
        .then(() => {
          this.promise = null
          this.state = 'idle'
        })

      return await this.promise
    },
    close() {
      channel.port1.removeAllListeners()
      channel.port2.removeAllListeners()
      channel.port2.close()
      channel.port1.close()
      return piscina.destroy()
    },
  }

  port.on('message', async({ id, method, args = [] }: RpcMessage) => {
    async function send(fn: () => Awaitable<any>) {
      try {
        port.postMessage({ id, result: await fn() })
      }
      catch (e) {
        port.postMessage({ id, error: e })
      }
    }

    switch (method) {
      case 'snapshotSaved':
        return send(() => ctx.snapshot.add(args[0] as any))
      case 'fetch':
        return send(() => transformRequest(ctx.server, ...args as RpcMap['fetch'][0]))
      case 'onCollected':
        ctx.state.onCollected(args[0] as any)
        break
      case 'onTaskUpdate':
        ctx.state.updateTasks([args[0] as any])
        break
    }

    if (method.startsWith('on')) {
      // forward reporter
      // @ts-expect-error
      return send(() => ctx.reporter[method]?.(...args))
    }

    console.error('Unhandled message', method, args)
  })

  return instance
}
