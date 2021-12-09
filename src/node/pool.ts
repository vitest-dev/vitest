import { MessageChannel, MessagePort } from 'worker_threads'
import { pathToFileURL } from 'url'
import Piscina from 'piscina'
import { Awaitable } from '@antfu/utils'
import { RpcMap } from 'vitest'
import { distDir } from '../constants'
import { WorkerContext, RpcMessage, VitestContext } from '../types'
import { transformRequest } from './transform'

export async function createWorker(files: WorkerContext['files'], ctx: VitestContext) {
  const piscina = new Piscina({
    filename: new URL('./dist/node/worker.js', pathToFileURL(distDir)).href,
    useAtomics: false,
  })

  const { port1: worker, port2: master } = new MessageChannel()

  handleRPC(master, ctx)

  await piscina.run({ port: worker, files, config: ctx.config }, { transferList: [worker] })
}

export function handleRPC(master: MessagePort, ctx: VitestContext) {
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
}
