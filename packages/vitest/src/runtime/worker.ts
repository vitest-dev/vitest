import { pathToFileURL } from 'node:url'
import { workerId as poolId } from 'tinypool'
import { ModuleCacheMap } from 'vite-node/client'
import type { ContextRPC } from '../types/rpc'
import { loadEnvironment } from '../integrations/env/loader'
import type { WorkerGlobalState } from '../types/worker'
import { setupInspect } from './inspector'
import { createRuntimeRpc, rpcDone } from './rpc'
import type { VitestWorker } from './workers/types'

export async function run(ctx: ContextRPC) {
  const prepareStart = performance.now()

  const inspectorCleanup = setupInspect(ctx.config)

  process.env.VITEST_WORKER_ID = String(ctx.workerId)
  process.env.VITEST_POOL_ID = String(poolId)

  try {
    if (ctx.worker[0] === '.')
      throw new Error(`Path to the test runner cannot be relative, received "${ctx.worker}"`)
    const file = ctx.worker.startsWith('file:') ? ctx.worker : pathToFileURL(ctx.worker).toString()
    const testRunnerModule = await import(file)
    if (typeof testRunnerModule.default !== 'function')
      throw new Error(`Test runner constructor should be exposed as a default export. Received "${typeof testRunnerModule.default}"`)
    const worker = testRunnerModule.default as VitestWorker
    const { rpc, onCancel } = createRuntimeRpc(worker.getRpcOptions(ctx))

    const beforeEnvironmentTime = performance.now()
    const environment = await loadEnvironment(ctx, rpc)
    if (ctx.environment.transformMode)
      environment.transformMode = ctx.environment.transformMode

    const state: WorkerGlobalState = {
      ctx,
      // create a new one, workers can reassign this if they need to
      moduleCache: new ModuleCacheMap(),
      mockMap: new Map(),
      config: ctx.config,
      onCancel,
      environment,
      durations: {
        environment: beforeEnvironmentTime,
        prepare: prepareStart,
      },
      rpc,
      providedContext: ctx.providedContext,
    }

    await worker.runTests(state)
  }
  finally {
    await rpcDone().catch(() => {})
    inspectorCleanup()
  }
}
