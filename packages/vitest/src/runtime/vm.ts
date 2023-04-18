import { URL, pathToFileURL } from 'node:url'
import { ModuleCacheMap } from 'vite-node/client'
import type { BirpcReturn } from 'birpc'
import { createBirpc } from 'birpc'
import { relative, resolve } from 'pathe'
import { processError } from '@vitest/runner/utils'
import { isPrimitive } from '@vitest/utils'
import { installSourcemapsSupport } from 'vite-node/source-map'
import type { RuntimeRPC, WorkerContext, WorkerGlobalState } from '../types'
import { distDir } from '../paths'
import { environments } from '../integrations/env'
import { VitestSnapshotEnvironment } from '../integrations/snapshot/environments/node'
import { createVitestExecutor } from './execute'

let rpc: BirpcReturn<RuntimeRPC>

const caches: Record<string, {
  moduleCache: ModuleCacheMap
  mockMap: Map<any, any>
}> = {}

// TODO: currently expects only one file in this function, which makes sense because the function itself is called for each file separately
export async function run(ctx: WorkerContext) {
  const file = ctx.files[0]
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
    durations: {
      environment: 0,
      prepare: performance.now(),
    },
    rpc,
  }

  installSourcemapsSupport({
    getSourceMap: source => moduleCache.getSourceMap(source),
  })

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

  config.snapshotOptions.snapshotEnvironment = new VitestSnapshotEnvironment()

  const environment = environments[ctx.environment.name as 'happy-dom']

  const vm = await environment.setupVm!({}, ctx.environment.options || {})

  // @ts-expect-error untyped global
  globalThis.__vitest_environment__ = config.environment
  // @ts-expect-error untyped global
  globalThis.__vitest_worker__ = __vitest_worker__

  const context = vm.getVmContext()

  context.__vitest_worker__ = __vitest_worker__
  context.__vitest_environment__ = config.environment
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
  context.console = console

  if (ctx.invalidates) {
    ctx.invalidates.forEach((fsPath) => {
      moduleCache.delete(fsPath)
      moduleCache.delete(`mock:${fsPath}`)
    })
  }
  ctx.files.forEach(i => moduleCache.delete(i))

  const executor = await createVitestExecutor({
    fetchModule(id) {
      return rpc.fetch(id, ctx.environment.name)
    },
    resolveId(id, importer) {
      return rpc.resolveId(id, importer, ctx.environment.name)
    },
    moduleCache,
    mockMap,
    interopDefault: config.deps.interopDefault,
    root: config.root,
    base: config.base,
    context,
  })

  context.__vitest_mocker__ = executor.mocker

  const { run } = await executor.executeId(pathToFileURL(resolve(distDir, 'entry-vm.js')).href)

  try {
    await run(ctx.files, ctx.config, ctx.environment, executor)
  }
  finally {
    await vm.teardown({})
  }
}
