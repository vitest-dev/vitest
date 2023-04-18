import { URL, pathToFileURL } from 'node:url'
import { ModuleCacheMap } from 'vite-node/client'
import { workerId as poolId } from 'tinypool'
import { createBirpc } from 'birpc'
import { resolve } from 'pathe'
import { installSourcemapsSupport } from 'vite-node/source-map'
import type { RuntimeRPC, WorkerContext, WorkerGlobalState } from '../types'
import { distDir } from '../paths'
import { environments } from '../integrations/env'
import { VitestSnapshotEnvironment } from '../integrations/snapshot/environments/node'
import { startVitestExecutor } from './execute'
import { createCustomConsole } from './console'

const entryFile = pathToFileURL(resolve(distDir, 'entry-vm.js')).href

// TODO: currently expects only one file in this function, which makes sense because the function itself is called for each file separately
export async function run(ctx: WorkerContext) {
  const moduleCache = new ModuleCacheMap()
  const mockMap = new Map()
  const { config, port } = ctx
  const rpc = createBirpc<RuntimeRPC>(
    {},
    {
      eventNames: ['onUserConsoleLog', 'onFinished', 'onCollected', 'onWorkerExit'],
      post(v) { port.postMessage(v) },
      on(fn) { port.addListener('message', fn) },
    },
  )
  const state: WorkerGlobalState = {
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

  installSourcemapsSupport({
    getSourceMap: source => moduleCache.getSourceMap(source),
  })

  config.snapshotOptions.snapshotEnvironment = new VitestSnapshotEnvironment(rpc)

  const environment = environments[ctx.environment.name as 'happy-dom']

  const vm = await environment.setupVM!({}, ctx.environment.options || {})

  process.env.VITEST_WORKER_ID = String(ctx.workerId)
  process.env.VITEST_POOL_ID = String(poolId)

  const context = vm.getVmContext()

  context.__vitest_worker__ = state
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
  context.console = createCustomConsole(state)

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
    state,
  })

  context.__vitest_mocker__ = executor.mocker

  const { run } = await executor.importExternalModule(entryFile)

  try {
    await run(ctx.files, ctx.config, executor)
  }
  finally {
    await vm.teardown({})
    state.environmentTeardownRun = true
  }
}
