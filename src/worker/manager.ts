import { MessageChannel } from 'worker_threads'
import { pathToFileURL } from 'url'
import Piscina from 'piscina'
import { Awaitable } from '@antfu/utils'
import { transformRequest } from '../node/transform'
import { distDir } from '../constants'
import { WorkerContext } from '../types'

export async function createWorker(ctx: Omit<WorkerContext, 'port'>) {
  const piscina = new Piscina({
    filename: new URL('./dist/worker/worker.js', pathToFileURL(distDir)).href,
    useAtomics: false,
  })

  const { port1: worker, port2: master } = new MessageChannel()
  const server = process.__vitest__.server

  master.on('message', async({ id, method, args = [] }) => {
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
        send(() => transformRequest(server, args[0]))
    }
  })

  return piscina.run({ port: worker, ...ctx }, { transferList: [worker] })
}
