import { resolve } from 'path'
import { nanoid } from 'nanoid'
import { RpcFn } from 'vitest'
import { distDir } from '../constants'
import { WorkerContext } from '../types'
import { executeInViteNode, ExecuteOptions } from './execute'

export default async(context: WorkerContext) => {
  const { config } = context

  const rpc: RpcFn = (method, ...args) => {
    return new Promise((resolve, reject) => {
      const id = nanoid()
      const fn = (data: any) => {
        if (data.id === id) {
          context.port.removeListener('message', fn)
          if (data.error)
            reject(data.error)
          else
            resolve(data.result)
        }
      }
      context.port.postMessage({ method, args, id })
      context.port.addListener('message', fn)
    })
  }

  process.__vitest_worker__ = {
    context,
    rpc,
  }

  const moduleCache: ExecuteOptions['moduleCache'] = new Map()

  const [{ run }] = await executeInViteNode({
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
  })

  await run(context)
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process {
      __vitest_worker__?: {
        context: WorkerContext
        rpc: RpcFn
      }
    }
  }
}
