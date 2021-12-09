import { resolve } from 'path'
import { MessagePort } from 'worker_threads'
import { nanoid } from 'nanoid'
import { RpcFn } from 'vitest'
import { distDir } from '../constants'
import { ResolvedConfig, WorkerContext } from '../types'
import { executeInViteNode, ExecuteOptions } from './execute'

export default async({ port, config }: WorkerContext) => {
  const promiseMap = new Map<string, { resolve: ((...args: any) => any); reject: (...args: any) => any }>()

  const rpc: RpcFn = (method, ...args) => {
    return new Promise((resolve, reject) => {
      const id = nanoid()
      promiseMap.set(id, { resolve, reject })
      port.postMessage({ method, args, id })
    })
  }

  process.__vitest_worker__ = {
    config,
    port,
    rpc,
  }

  const moduleCache: ExecuteOptions['moduleCache'] = new Map()

  let run: (files: string[], config: ResolvedConfig) => Promise<void>

  port.addListener('message', async(data) => {
    if (data.method === 'run') {
      await run(data.files, config)
      port.postMessage({ method: 'workerReady' })
    }
    else {
      const api = promiseMap.get(data.id)
      if (api) {
        if (data.error)
          api.reject(data.error)
        else
          api.resolve(data.result)
      }
    }
  })

  run = (await executeInViteNode({
    root: config.root,
    files: [
      resolve(distDir, 'runtime/entry.js'),
    ],
    fetch(id) {
      return rpc('fetch', id)
    },
    inline: config.depsInline,
    external: config.depsExternal,
    moduleCache,
  }))[0].run

  port.postMessage({ method: 'workerReady' })
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process {
      __vitest_worker__?: {
        config: ResolvedConfig
        port: MessagePort
        rpc: RpcFn
      }
    }
  }
}
