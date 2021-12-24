import { resolve } from 'pathe'
import { nanoid } from 'nanoid/non-secure'
import type { ModuleCache, ResolvedConfig, RpcCall, RpcSend, Test, WorkerContext } from '../types'
import { distDir } from '../constants'
import { executeInViteNode } from '../node/execute'
import { send } from './rpc'

let _viteNode: {
  run: (files: string[], config: ResolvedConfig) => Promise<void>
  collect: (files: string[], config: ResolvedConfig) => Promise<void>
}
const moduleCache: Map<string, ModuleCache> = new Map()
const mockMap = {}

async function startViteNode(ctx: WorkerContext) {
  if (_viteNode)
    return _viteNode

  const processExit = process.exit

  process.on('beforeExit', (code) => {
    send('processExit', code)
  })

  process.exit = (code = process.exitCode || 0): never => {
    send('processExit', code)
    return processExit(code)
  }

  const { config } = ctx

  const { run, collect } = (await executeInViteNode({
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
    mockMap,
  }))[0]

  _viteNode = { run, collect }

  return _viteNode
}

function init(ctx: WorkerContext) {
  if (process.__vitest_worker__ && ctx.config.threads)
    throw new Error(`worker for ${ctx.files.join(',')} already initialized by ${process.__vitest_worker__.ctx.files.join(',')}. This is probably an internal bug of Vitest.`)

  process.stdout.write('\0')

  const { config, port } = ctx
  const rpcPromiseMap = new Map<string, { resolve: ((...args: any) => any); reject: (...args: any) => any }>()

  process.__vitest_worker__ = {
    ctx,
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

  if (ctx.invalidates)
    ctx.invalidates.forEach(i => moduleCache.delete(i))
  ctx.files.forEach(i => moduleCache.delete(i))
}

export async function collect(ctx: WorkerContext) {
  init(ctx)
  const { collect } = await startViteNode(ctx)
  return collect(ctx.files, ctx.config)
}

export async function run(ctx: WorkerContext) {
  init(ctx)
  const { run } = await startViteNode(ctx)
  return run(ctx.files, ctx.config)
}

declare global {
  namespace NodeJS {
    interface Process {
      __vitest_worker__: {
        ctx: WorkerContext
        config: ResolvedConfig
        rpc: RpcCall
        send: RpcSend
        current?: Test
        filepath?: string
        moduleCache: Map<string, ModuleCache>
      }
    }
  }
}
