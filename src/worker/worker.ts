import { resolve } from 'path/posix'
import { nanoid } from 'nanoid'
import { executeInViteNode, ExecuteOptions } from '../node/execute'
import { distDir } from '../constants'
import { WorkerContext } from '../types'

function rpc<T = any>(ctx: WorkerContext, method: string, ...args: any[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = nanoid()
    const fn = (data: any) => {
      if (data.id === id) {
        ctx.port.removeListener('message', fn)
        if (data.error)
          reject(data.error)
        else
          resolve(data.result)
      }
    }
    ctx.port.postMessage({ method, args, id })
    ctx.port.addListener('message', fn)
  })
}

export default async(context: WorkerContext) => {
  // process.stdout.write('\0')

  const { config } = context

  const moduleCache: ExecuteOptions['moduleCache'] = new Map()

  const [{ run }] = await executeInViteNode({
    root: config.root,
    files: [
      resolve(distDir, 'runtime/entry.js'),
    ],
    fetch(id) {
      return rpc(context, 'fetch', id)
    },
    inline: config.depsInline,
    external: config.depsExternal,
    moduleCache,
  })

  await run(context)
}
