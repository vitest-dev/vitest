import { MessageChannel } from 'worker_threads'
import { pathToFileURL } from 'url'
import Piscina from 'piscina'
import { Awaitable } from '@antfu/utils'
import { RpcMap } from 'vitest'
import { nanoid } from 'nanoid'
import { distDir } from '../constants'
import { WorkerContext, RpcMessage, VitestContext, WorkerInstance } from '../types'
import { transformRequest } from './transform'

export function createWorker(ctx: VitestContext) {
  const piscina = new Piscina({
    filename: new URL('./dist/node/worker.js', pathToFileURL(distDir)).href,
    useAtomics: false,
  })

  const channel = new MessageChannel()
  const port = channel.port1

  const onReadyResolves: (() => void)[] = []

  const instance: WorkerInstance = {
    id: nanoid(),
    state: 'init',
    port,
    async untilReady() {
      if (this.state === 'idle')
        return
      return new Promise((resolve) => {
        onReadyResolves.push(resolve)
      })
    },
    async run(files: string[]) {
      this.state = 'run'
      port.postMessage({ method: 'run', files })
      return this.untilReady()
    },
    close() {
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
      case 'workerReady':
        instance.state = 'idle'
        onReadyResolves.forEach(resolve => resolve())
        onReadyResolves.length = 0
        return
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

  const meta: WorkerContext = { port: channel.port2, config: ctx.config }
  piscina.run(meta, { transferList: [channel.port2] })

  return instance
}
