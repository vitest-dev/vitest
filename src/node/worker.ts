import { resolve } from 'path'
import { MessagePort } from 'worker_threads'
import { nanoid } from 'nanoid'
import { RpcFn } from 'vitest'
import { distDir } from '../constants'
import { ResolvedConfig, WorkerContext } from '../types'
import { executeInViteNode, ExecuteOptions } from './execute'

let _ctx: WorkerContext
let _run: (files: string[], config: ResolvedConfig) => Promise<void>

export async function init(ctx: WorkerContext) {
  _ctx = ctx
  const { port, config } = ctx

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

  port.addListener('message', async(data) => {
    const api = promiseMap.get(data.id)
    if (api) {
      if (data.error)
        api.reject(data.error)
      else
        api.resolve(data.result)
    }
  })

  _run = (await executeInViteNode({
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
}

export function run(files: string[]) {
  return _run(files, _ctx.config)
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
