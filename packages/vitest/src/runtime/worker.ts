import type { ContextRPC, WorkerGlobalState } from '../types/worker'
import type { VitestWorker } from './workers/types'
import { pathToFileURL } from 'node:url'
import { createStackString, parseStacktrace } from '@vitest/utils/source-map'
import { workerId as poolId } from 'tinypool'
import { ModuleCacheMap } from 'vite-node/client'
import { loadEnvironment } from '../integrations/env/loader'
import { setupInspect } from './inspector'
import { createRuntimeRpc, rpcDone } from './rpc'
import { isChildProcess, setProcessTitle } from './utils'
import { disposeInternalListeners } from './workers/utils'

if (isChildProcess()) {
  setProcessTitle(`vitest ${poolId}`)

  const isProfiling = process.execArgv.some(
    execArg =>
      execArg.startsWith('--prof')
      || execArg.startsWith('--cpu-prof')
      || execArg.startsWith('--heap-prof')
      || execArg.startsWith('--diagnostic-dir'),
  )

  if (isProfiling) {
    // Work-around for nodejs/node#55094
    process.on('SIGTERM', () => {
      process.exit()
    })
  }
}

// this is what every pool executes when running tests
async function execute(method: 'run' | 'collect', ctx: ContextRPC) {
  disposeInternalListeners()

  const prepareStart = performance.now()

  const inspectorCleanup = setupInspect(ctx)

  process.env.VITEST_WORKER_ID = String(ctx.workerId)
  process.env.VITEST_POOL_ID = String(poolId)

  try {
    await Promise.all(ctx.config.preloads?.map(file => import(file)))

    // worker is a filepath or URL to a file that exposes a default export with "getRpcOptions" and "runTests" methods
    if (ctx.worker[0] === '.') {
      throw new Error(
        `Path to the test runner cannot be relative, received "${ctx.worker}"`,
      )
    }

    const file = ctx.worker.startsWith('file:')
      ? ctx.worker
      : pathToFileURL(ctx.worker).toString()
    const testRunnerModule = await import(file)

    if (
      !testRunnerModule.default
      || typeof testRunnerModule.default !== 'object'
    ) {
      throw new TypeError(
        `Test worker object should be exposed as a default export. Received "${typeof testRunnerModule.default}"`,
      )
    }

    const worker = testRunnerModule.default as VitestWorker
    if (!worker.getRpcOptions || typeof worker.getRpcOptions !== 'function') {
      throw new TypeError(
        `Test worker should expose "getRpcOptions" method. Received "${typeof worker.getRpcOptions}".`,
      )
    }

    // RPC is used to communicate between worker (be it a thread worker or child process or a custom implementation) and the main thread
    const { rpc, onCancel } = createRuntimeRpc(worker.getRpcOptions(ctx))

    const beforeEnvironmentTime = performance.now()
    const environment = await loadEnvironment(ctx, rpc)
    if (ctx.environment.transformMode) {
      environment.transformMode = ctx.environment.transformMode
    }

    const state = {
      ctx,
      // here we create a new one, workers can reassign this if they need to keep it non-isolated
      moduleCache: new ModuleCacheMap(),
      config: ctx.config,
      onCancel,
      environment,
      durations: {
        environment: beforeEnvironmentTime,
        prepare: prepareStart,
      },
      rpc,
      providedContext: ctx.providedContext,
      onFilterStackTrace(stack) {
        return createStackString(parseStacktrace(stack))
      },
    } satisfies WorkerGlobalState

    const methodName = method === 'collect' ? 'collectTests' : 'runTests'

    if (!worker[methodName] || typeof worker[methodName] !== 'function') {
      throw new TypeError(
        `Test worker should expose "runTests" method. Received "${typeof worker.runTests}".`,
      )
    }

    await worker[methodName](state)
  }
  finally {
    await rpcDone().catch(() => {})
    inspectorCleanup()
  }
}

export function run(ctx: ContextRPC) {
  return execute('run', ctx)
}

export function collect(ctx: ContextRPC) {
  return execute('collect', ctx)
}
