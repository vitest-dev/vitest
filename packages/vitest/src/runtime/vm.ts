import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { isContext } from 'node:vm'
import { ModuleCacheMap } from 'vite-node/client'
import { workerId as poolId } from 'tinypool'
import { createBirpc } from 'birpc'
import { resolve } from 'pathe'
import { installSourcemapsSupport } from 'vite-node/source-map'
import type { CancelReason } from '@vitest/runner'
import type { RunnerRPC, RuntimeRPC, WorkerContext, WorkerGlobalState } from '../types'
import { distDir } from '../paths'
import { loadEnvironment } from '../integrations/env/loader'
import { startVitestExecutor } from './execute'
import { createCustomConsole } from './console'
import { createSafeRpc } from './rpc'

const entryFile = pathToFileURL(resolve(distDir, 'entry-vm.js')).href

export async function run(ctx: WorkerContext) {
  const moduleCache = new ModuleCacheMap()
  const mockMap = new Map()
  const { config, port, providedContext } = ctx

  let setCancel = (_reason: CancelReason) => {}
  const onCancel = new Promise<CancelReason>((resolve) => {
    setCancel = resolve
  })

  const rpc = createSafeRpc(createBirpc<RuntimeRPC, RunnerRPC>(
    {
      onCancel: setCancel,
    },
    {
      eventNames: ['onUserConsoleLog', 'onFinished', 'onCollected', 'onWorkerExit'],
      post(v) { port.postMessage(v) },
      on(fn) { port.addListener('message', fn) },
    },
  ))

  const environment = await loadEnvironment(ctx.environment.name, {
    root: ctx.config.root,
    fetchModule: id => rpc.fetch(id, 'ssr'),
    resolveId: (id, importer) => rpc.resolveId(id, importer, 'ssr'),
  })

  if (!environment.setupVM) {
    const envName = ctx.environment.name
    const packageId = envName[0] === '.' ? envName : `vitest-environment-${envName}`
    throw new TypeError(
    `Environment "${ctx.environment.name}" is not a valid environment. `
  + `Path "${packageId}" doesn't support vm environment because it doesn't provide "setupVM" method.`,
    )
  }

  const state: WorkerGlobalState = {
    ctx,
    moduleCache,
    config,
    mockMap,
    onCancel,
    environment,
    durations: {
      environment: performance.now(),
      prepare: performance.now(),
    },
    rpc,
    providedContext,
  }

  installSourcemapsSupport({
    getSourceMap: source => moduleCache.getSourceMap(source),
  })

  const vm = await environment.setupVM(ctx.environment.options || ctx.config.environmentOptions || {})

  state.durations.environment = performance.now() - state.durations.environment

  process.env.VITEST_WORKER_ID = String(ctx.workerId)
  process.env.VITEST_POOL_ID = String(poolId)
  process.env.VITEST_VM_POOL = '1'

  if (!vm.getVmContext)
    throw new TypeError(`Environment ${ctx.environment.name} doesn't provide "getVmContext" method. It should return a context created by "vm.createContext" method.`)

  const context = vm.getVmContext()

  if (!isContext(context))
    throw new TypeError(`Environment ${ctx.environment.name} doesn't provide a valid context. It should be created by "vm.createContext" method.`)

  Object.defineProperty(context, '__vitest_worker__', {
    value: state,
    configurable: true,
    writable: true,
    enumerable: false,
  })
  // this is unfortunately needed for our own dependencies
  // we need to find a way to not rely on this by default
  // because browser doesn't provide these globals
  context.process = process
  context.global = context
  context.console = createCustomConsole(state)
  // TODO: don't hardcode setImmediate in fake timers defaults
  context.setImmediate = setImmediate
  context.clearImmediate = clearImmediate

  if (ctx.invalidates) {
    ctx.invalidates.forEach((fsPath) => {
      moduleCache.delete(fsPath)
      moduleCache.delete(`mock:${fsPath}`)
    })
  }
  ctx.files.forEach(i => moduleCache.delete(i))

  const executor = await startVitestExecutor({
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
    await vm.teardown?.()
    state.environmentTeardownRun = true
  }
}
