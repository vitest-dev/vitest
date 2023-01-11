import { relative, resolve } from 'pathe'
import { createBirpc } from 'birpc'
import { workerId as poolId } from 'tinypool'
import { ModuleCacheMap } from 'vite-node/client'
import { isPrimitive } from 'vite-node/utils'
import type { ResolvedConfig, WorkerContext, WorkerRPC } from '../types'
import { distDir } from '../constants'
import { getWorkerState } from '../utils'
import type { MockMap } from '../types/mocker'
import { executeInViteNode } from './execute'
import { rpc } from './rpc'
import { processError } from './error'

let _viteNode: {
  run: (files: string[], config: ResolvedConfig) => Promise<void>
}

const moduleCache = new ModuleCacheMap()
const mockMap: MockMap = new Map()

async function startViteNode(ctx: WorkerContext) {
  if (_viteNode)
    return _viteNode

  const { config } = ctx

  const processExit = process.exit

  process.on('beforeExit', (code) => {
    rpc().onWorkerExit(code)
  })

  process.exit = (code = process.exitCode || 0): never => {
    rpc().onWorkerExit(code)
    return processExit(code)
  }

  process.on('unhandledRejection', (err) => {
    const worker = getWorkerState()
    const error = processError(err)
    if (worker.filepath && !isPrimitive(error)) {
      error.VITEST_TEST_NAME = worker.current?.name
      error.VITEST_TEST_PATH = relative(config.root, worker.filepath)
    }
    rpc().onUnhandledRejection(error)
  })

  const { run } = (await executeInViteNode({
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
    interopDefault: config.deps.interopDefault,
    root: config.root,
    base: config.base,
  }))[0]

  _viteNode = { run }

  return _viteNode
}

function init(ctx: WorkerContext) {
  // @ts-expect-error untyped global
  if (typeof __vitest_worker__ !== 'undefined' && ctx.config.threads && ctx.config.isolate)
    throw new Error(`worker for ${ctx.files.join(',')} already initialized by ${getWorkerState().ctx.files.join(',')}. This is probably an internal bug of Vitest.`)

  const { config, port, workerId } = ctx

  process.env.VITEST_WORKER_ID = String(workerId)
  process.env.VITEST_POOL_ID = String(poolId)

  // @ts-expect-error untyped global
  globalThis.__vitest_environment__ = config.environment
  // @ts-expect-error I know what I am doing :P
  globalThis.__vitest_worker__ = {
    ctx,
    moduleCache,
    config,
    mockMap,
    rpc: createBirpc<WorkerRPC>(
      {},
      {
        eventNames: ['onUserConsoleLog', 'onFinished', 'onCollected', 'onWorkerExit'],
        post(v) { port.postMessage(v) },
        on(fn) { port.addListener('message', fn) },
      },
    ),
  }

  if (ctx.invalidates) {
    ctx.invalidates.forEach((fsPath) => {
      moduleCache.delete(fsPath)
      moduleCache.delete(`mock:${fsPath}`)
    })
  }
  ctx.files.forEach(i => moduleCache.delete(i))
}

export async function run(ctx: WorkerContext) {
  init(ctx)
  const { run } = await startViteNode(ctx)
  return run(ctx.files, ctx.config)
}
