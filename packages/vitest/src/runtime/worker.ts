import { resolve } from 'pathe'
import type { BirpcReturn } from 'birpc'
import { createBirpc } from 'birpc'
import type { ModuleCache, ResolvedConfig, Test, WorkerContext, WorkerRPC } from '../types'
import { distDir } from '../constants'
import { executeInViteNode } from '../node/execute'
import { rpc } from './rpc'

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
    rpc().onWorkerExit(code)
  })

  process.exit = (code = process.exitCode || 0): never => {
    rpc().onWorkerExit(code)
    return processExit(code)
  }

  const { config } = ctx

  const { run, collect } = (await executeInViteNode({
    root: config.root,
    files: [
      resolve(distDir, 'entry.js'),
    ],
    fetch(id) {
      return rpc().fetch(id)
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

  process.__vitest_worker__ = {
    ctx,
    moduleCache,
    config,
    rpc: createBirpc<{}, WorkerRPC>({
      functions: {},
      eventNames: ['onUserLog', 'onCollected', 'onWorkerExit'],
      post(v) { port.postMessage(v) },
      on(fn) { port.addListener('message', fn) },
    }),
  }

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
        rpc: BirpcReturn<WorkerRPC>
        current?: Test
        filepath?: string
        moduleCache: Map<string, ModuleCache>
      }
    }
  }
}
