import type { ModuleRunner } from 'vite/module-runner'
import type { ContextRPC, WorkerGlobalState } from '../types/worker'
import type { VitestWorker } from './workers/types'
import { createStackString, parseStacktrace } from '@vitest/utils/source-map'
import { workerId as poolId } from 'tinypool'
import { EvaluatedModules } from 'vite/module-runner'
import { loadEnvironment } from '../integrations/env/loader'
import { closeInspector, setupInspect } from './inspector'
import { createRuntimeRpc, isChildProcess, rpcDone } from './utils'
import { disposeInternalListeners } from './workers/utils'

if (isChildProcess()) {
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

const globalCleanups = new Set<() => unknown>()
const resolvingModules = new Set<string>()

// this is what every pool executes when running tests
async function execute(method: 'run' | 'collect', ctx: ContextRPC, worker: VitestWorker) {
  disposeInternalListeners()

  const prepareStart = performance.now()

  const localCleanups: (() => void | Promise<void>)[] = [setupInspect(ctx)]

  process.env.VITEST_WORKER_ID = String(ctx.workerId)
  process.env.VITEST_POOL_ID = String(poolId)

  let environmentLoader: ModuleRunner | undefined

  try {
    // RPC is used to communicate between worker (be it a thread worker or child process or a custom implementation) and the main thread
    const { rpc, onCancel } = createRuntimeRpc(worker.getRpcOptions(ctx))

    // do not close the RPC channel so that we can get the error messages sent to the main thread
    localCleanups.push(async () => {
      await Promise.all(rpc.$rejectPendingCalls(({ method, reject }) => {
        reject(new Error(`[vitest-worker]: Closing rpc while "${method}" was pending`))
      }))
    })
    onCancel.then(() => {
      closeInspector(ctx.config)
    })

    const beforeEnvironmentTime = performance.now()
    const { environment, loader } = await loadEnvironment(ctx, rpc)
    environmentLoader = loader

    const state = {
      ctx,
      // here we create a new one, workers can reassign this if they need to keep it non-isolated
      evaluatedModules: new EvaluatedModules(),
      resolvingModules,
      moduleExecutionInfo: new Map(),
      config: ctx.config,
      onCancel,
      environment,
      durations: {
        environment: beforeEnvironmentTime,
        prepare: prepareStart,
      },
      rpc,
      onCleanup: listener => globalCleanups.add(listener),
      providedContext: ctx.providedContext,
      onFilterStackTrace(stack) {
        return createStackString(parseStacktrace(stack))
      },
      metaEnv: createImportMetaEnvProxy(),
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
    await Promise.all(localCleanups.map(fn => fn()))

    await rpcDone().catch(() => {})
    environmentLoader?.close()
  }
}

export function run(ctx: ContextRPC, worker: VitestWorker): Promise<void> {
  return execute('run', ctx, worker)
}

export function collect(ctx: ContextRPC, worker: VitestWorker): Promise<void> {
  return execute('collect', ctx, worker)
}

export async function teardown(): Promise<void> {
  const promises = [...globalCleanups].map(l => l())
  await Promise.all(promises)
}

function createImportMetaEnvProxy(): WorkerGlobalState['metaEnv'] {
  // packages/vitest/src/node/plugins/index.ts:146
  const booleanKeys = ['DEV', 'PROD', 'SSR']
  return new Proxy(process.env, {
    get(_, key) {
      if (typeof key !== 'string') {
        return undefined
      }
      if (booleanKeys.includes(key)) {
        return !!process.env[key]
      }
      return process.env[key]
    },
    set(_, key, value) {
      if (typeof key !== 'string') {
        return true
      }

      if (booleanKeys.includes(key)) {
        process.env[key] = value ? '1' : ''
      }
      else {
        process.env[key] = value
      }

      return true
    },
  }) as WorkerGlobalState['metaEnv']
}
