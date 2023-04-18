import { URL, pathToFileURL } from 'node:url'
import { ModuleCacheMap } from 'vite-node/client'
import type { BirpcReturn } from 'birpc'
import { workerId as poolId } from 'tinypool'
import { createBirpc } from 'birpc'
import { relative, resolve } from 'pathe'
import { processError } from '@vitest/runner/utils'
import { isPrimitive } from '@vitest/utils'
// import { installSourcemapsSupport } from 'vite-node/source-map'
import type { RuntimeRPC, WorkerContext, WorkerGlobalState } from '../types'
import { distDir } from '../paths'
import { environments } from '../integrations/env'
import { VitestSnapshotEnvironment } from '../integrations/snapshot/environments/node'
import { startVitestExecutor } from './execute'
// import { createCustomConsole } from './console'

const entryFile = pathToFileURL(resolve(distDir, 'entry-vm.js')).href

let rpc: BirpcReturn<RuntimeRPC>

const caches: Record<string, {
  moduleCache: ModuleCacheMap
  mockMap: Map<any, any>
}> = {}

// TODO: currently expects only one file in this function, which makes sense because the function itself is called for each file separately
export async function run(ctx: WorkerContext) {
  const file = ctx.files[0]
  // cache is for reruning the same file in watch mode
  const cache = caches[file] || {}
  const moduleCache = cache.moduleCache ??= new ModuleCacheMap()
  cache.moduleCache = moduleCache
  const mockMap = cache.mockMap ?? new Map()
  cache.mockMap = mockMap
  caches[file] = cache
  const { config, port } = ctx
  rpc = createBirpc<RuntimeRPC>(
    {},
    {
      eventNames: ['onUserConsoleLog', 'onFinished', 'onCollected', 'onWorkerExit'],
      post(v) { port.postMessage(v) },
      on(fn) { port.addListener('message', fn) },
    },
  )
  const __vitest_worker__: WorkerGlobalState = {
    ctx,
    moduleCache,
    config,
    mockMap,
    environment: ctx.environment.name,
    durations: {
      environment: 0,
      prepare: performance.now(),
    },
    rpc,
  }

  // installSourcemapsSupport({
  //   getSourceMap: source => moduleCache.getSourceMap(source),
  // })

  const processExit = process.exit

  process.exit = (code = process.exitCode || 0): never => {
    const error = new Error(`process.exit called with "${code}"`)
    rpc.onWorkerExit(error, code)
    return processExit(code)
  }

  function catchError(err: unknown, type: string) {
    const worker = __vitest_worker__
    const error = processError(err)
    if (!isPrimitive(error)) {
      error.VITEST_TEST_NAME = worker.current?.name
      if (worker.filepath)
        error.VITEST_TEST_PATH = relative(config.root, worker.filepath)
      error.VITEST_AFTER_ENV_TEARDOWN = worker.environmentTeardownRun
    }
    rpc.onUnhandledError(error, type)
  }

  process.on('uncaughtException', e => catchError(e, 'Uncaught Exception'))
  process.on('unhandledRejection', e => catchError(e, 'Unhandled Rejection'))

  config.snapshotOptions.snapshotEnvironment = new VitestSnapshotEnvironment(rpc)

  const environment = environments[ctx.environment.name as 'happy-dom']

  const vm = await environment.setupVm!({}, ctx.environment.options || {})

  process.env.VITEST_WORKER_ID = String(ctx.workerId)
  process.env.VITEST_POOL_ID = String(poolId)

  const context = vm.getVmContext()

  context.__vitest_worker__ = __vitest_worker__
  // TODO: all globals for test/core to work
  // TODO: copy more globals
  context.process = process
  context.URL ??= URL
  context.performance ??= performance
  context.setImmediate = setImmediate
  context.clearImmediate = clearImmediate
  context.setTimeout = setTimeout
  context.clearTimeout = clearTimeout
  context.setInterval = setInterval
  context.clearInterval = clearInterval
  context.global = context
  // context.console = createCustomConsole()

  if (ctx.invalidates) {
    ctx.invalidates.forEach((fsPath) => {
      moduleCache.delete(fsPath)
      moduleCache.delete(`mock:${fsPath}`)
    })
  }
  ctx.files.forEach(i => moduleCache.delete(i))

  const executor = await startVitestExecutor(ctx, {
    context,
    moduleCache,
    mockMap,
    state: __vitest_worker__,
  })

  context.__vitest_mocker__ = executor.mocker

  const { run } = await executor.importExternalModule(entryFile)

  try {
    await run(ctx.files, ctx.config, ctx.environment, executor)
  }
  finally {
    await vm.teardown({})
    __vitest_worker__.environmentTeardownRun = true
  }
}
