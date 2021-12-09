import { MessageChannel, MessagePort } from 'worker_threads'
import { pathToFileURL } from 'url'
import Piscina from 'piscina'
import { Awaitable } from '@antfu/utils'
import { RpcMap } from 'vitest'
import { ViteDevServer } from 'vite'
import { distDir } from '../constants'
import { WorkerContext, RpcMessage } from '../types'
import { transformRequest } from './transform'
import { StateManager } from './state'

export async function createWorker(ctx: Omit<WorkerContext, 'port'>) {
  const piscina = new Piscina({
    filename: new URL('./dist/node/worker.js', pathToFileURL(distDir)).href,
    useAtomics: false,
  })

  const { port1: worker, port2: master } = new MessageChannel()
  const { server, state } = process.__vitest__

  handleRPC(master, state, server, ctx)

  await piscina.run({ port: worker, ...ctx }, { transferList: [worker] })
}

export function handleRPC(master: MessagePort, state: StateManager, server: ViteDevServer, ctx: Omit<WorkerContext, 'port'>) {
  master.on('message', async({ id, method, args = [] }: RpcMessage) => {
    async function send(fn: () => Awaitable<any>) {
      try {
        master.postMessage({ id, result: await fn() })
      }
      catch (e) {
        master.postMessage({ id, error: e })
      }
    }

    switch (method) {
      case 'fetch':
        return send(() => transformRequest(server, ...args as RpcMap['fetch'][0]))
      case 'onCollected':
        state.onCollected(args[0] as any)
        break
      case 'onTaskUpdate':
        state.updateTasks([args[0] as any])
        break
    }

    if (method.startsWith('on')) {
      // forward reporter
      // @ts-expect-error
      return send(() => ctx.reporter[method]?.(...args))
    }

    console.error('Unhandled message', method, args)
  })
}
