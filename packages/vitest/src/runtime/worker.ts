import { resolve } from 'pathe'
import { createBirpc } from 'birpc'
import type { ModuleCache, ResolvedConfig, WorkerContext, WorkerGlobalState, WorkerRPC } from '../types'
import { distDir } from '../constants'
import { executeInViteNode } from '../node/execute'
import { rpc } from './rpc'

let _viteNode: {
  run: (files: string[], config: ResolvedConfig) => Promise<void>
  collect: (files: string[], config: ResolvedConfig) => Promise<void>
}
let __vitest_worker__: WorkerGlobalState
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
    files: [
      resolve(distDir, 'entry.js'),
    ],
    fetchModule(id) {
      return rpc().fetch(id)
    },
    resolveId(id, importer) {
      return rpc().resolveId(id, importer)
    },
    moduleCache,
    mockMap,
    interopDefault: config.deps.interopDefault ?? true,
    root: config.root,
    base: config.base,
  }))[0]

  _viteNode = { run, collect }

  return _viteNode
}

function init(ctx: WorkerContext) {
  if (__vitest_worker__ && ctx.config.threads && ctx.config.isolate)
    throw new Error(`worker for ${ctx.files.join(',')} already initialized by ${__vitest_worker__.ctx.files.join(',')}. This is probably an internal bug of Vitest.`)

  process.stdout.write('\0')

  const { config, port, id } = ctx

  process.env.VITEST_WORKER_ID = String(id)

  // @ts-expect-error I know what I am doing :P
  globalThis.__vitest_worker__ = {
    ctx,
    moduleCache,
    config,
    rpc: createBirpc<WorkerRPC>(
      {},
      {
        eventNames: ['onUserConsoleLog', 'onFinished', 'onCollected', 'onWorkerExit'],
        post(v) { port.postMessage(v) },
        on(fn) { port.addListener('message', fn) },
      },
    ),
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
  let __vitest_worker__: import('vitest').WorkerGlobalState
}
