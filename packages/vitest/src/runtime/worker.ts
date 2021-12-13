import { resolve } from 'path'
import { nanoid } from 'nanoid/non-secure'
import type { WorkerContext, ResolvedConfig, ModuleCache } from '../types'
import { distDir } from '../constants'
import { executeInViteNode } from '../node/execute'
import { send } from './rpc'

let _run: (files: string[], config: ResolvedConfig) => Promise<void>
const moduleCache: Map<string, ModuleCache> = new Map()

export async function init(ctx: WorkerContext) {
  if (_run)
    return _run

  const processExit = process.exit

  process.on('beforeExit', (code) => {
    send('processExit', code)
  })

  process.exit = (code = process.exitCode || 0): never => {
    send('processExit', code)
    return processExit(code)
  }

  const { config } = ctx

  _run = (await executeInViteNode({
    root: config.root,
    files: [
      resolve(distDir, 'entry.js'),
    ],
    fetch(id) {
      return process.__vitest_worker__.rpc('fetch', id)
    },
    inline: config.depsInline,
    external: config.depsExternal,
    interpretDefault: config.interpretDefault,
    moduleCache,
  }))[0].run

  return _run
}

export default async function run(ctx: WorkerContext) {
  process.stdout.write('\0')

  const { config, port } = ctx
  const rpcPromiseMap = new Map<string, { resolve: ((...args: any) => any); reject: (...args: any) => any }>()

  process.__vitest_worker__ = {
    moduleCache,
    config,
    rpc: (method, ...args) => {
      return new Promise((resolve, reject) => {
        const id = nanoid()
        rpcPromiseMap.set(id, { resolve, reject })
        port.postMessage({ method, args, id })
      })
    },
    send(method, ...args) {
      port.postMessage({ method, args })
    },
  }

  port.addListener('message', async(data) => {
    const api = rpcPromiseMap.get(data.id)
    if (api) {
      if (data.error)
        api.reject(data.error)
      else
        api.resolve(data.result)
    }
  })

  const run = await init(ctx)

  if (ctx.invalidates)
    ctx.invalidates.forEach(i => moduleCache.delete(i))
  ctx.files.forEach(i => moduleCache.delete(i))

  return run(ctx.files, ctx.config)
}
