import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { ModuleCacheMap } from 'vite-node/client'
import { workerId as poolId } from 'tinypool'
import { createBirpc } from 'birpc'
import { resolve } from 'pathe'
import { installSourcemapsSupport } from 'vite-node/source-map'
import type { CancelReason } from '@vitest/runner'
import type { RuntimeRPC, WorkerContext, WorkerGlobalState } from '../types'
import { distDir } from '../paths'
import { startVitestExecutor } from './execute'
import { createCustomConsole } from './console'
import { loadEnvironment } from './environment'

const entryFile = pathToFileURL(resolve(distDir, 'entry-vm.js')).href

export async function run(ctx: WorkerContext) {
  const moduleCache = new ModuleCacheMap()
  const mockMap = new Map()
  const { config, port } = ctx

  let setCancel = (_reason: CancelReason) => {}
  const onCancel = new Promise<CancelReason>((resolve) => {
    setCancel = resolve
  })

  const rpc = createBirpc<RuntimeRPC>(
    {
      onCancel: setCancel,
    },
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
    onCancel,
    environment: ctx.environment.name,
    durations: {
      environment: performance.now(),
      prepare: performance.now(),
    },
    rpc,
  }

  installSourcemapsSupport({
    getSourceMap: source => moduleCache.getSourceMap(source),
  })

  const environment = await loadEnvironment(ctx.environment.name, 'setupVM')

  const vm = await environment.setupVM!(ctx.environment.options || {})

  state.durations.environment = performance.now() - state.durations.environment

  process.env.VITEST_WORKER_ID = String(ctx.workerId)
  process.env.VITEST_POOL_ID = String(poolId)

  const context = vm.getVmContext()

  context.__vitest_worker__ = state
  // this is unfortunately needed for our own dependencies
  // we need to find a way to not rely on this by default
  context.process = process
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
    await vm.teardown()
    state.environmentTeardownRun = true
  }
}
