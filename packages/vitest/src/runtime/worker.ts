import type { ModuleRunner } from 'vite/module-runner'
import type { ContextRPC, WorkerGlobalState } from '../types/worker'
import type { VitestWorker } from './workers/types'
import { createStackString, parseStacktrace } from '@vitest/utils/source-map'
import { loadEnvironment } from '../integrations/env/loader'
import { setupInspect } from './inspector'
import { VitestEvaluatedModules } from './moduleRunner/evaluatedModules'
import { createRuntimeRpc, rpcDone } from './rpc'

const resolvingModules = new Set<string>()
const globalListeners = new Set<() => unknown>()

async function execute(method: 'run' | 'collect', ctx: ContextRPC, worker: VitestWorker) {
  const prepareStart = performance.now()

  const cleanups: (() => void | Promise<void>)[] = [setupInspect(ctx)]

  let environmentLoader: ModuleRunner | undefined

  // RPC is used to communicate between worker (be it a thread worker or child process or a custom implementation) and the main thread
  const { rpc, onCancel } = createRuntimeRpc(worker)

  try {
    // do not close the RPC channel so that we can get the error messages sent to the main thread
    cleanups.push(async () => {
      await Promise.all(rpc.$rejectPendingCalls(({ method, reject }) => {
        reject(new Error(`[vitest-worker]: Closing rpc while "${method}" was pending`))
      }))
    })

    const beforeEnvironmentTime = performance.now()
    const { environment, loader } = await loadEnvironment(ctx, rpc)
    environmentLoader = loader

    const state = {
      ctx,
      // here we create a new one, workers can reassign this if they need to keep it non-isolated
      evaluatedModules: new VitestEvaluatedModules(),
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
      onCleanup: listener => globalListeners.add(listener),
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
    await rpcDone().catch(() => {})
    await Promise.all(cleanups.map(fn => fn())).catch(() => {})
    await environmentLoader?.close()
  }
}

export function run(ctx: ContextRPC, worker: VitestWorker): Promise<void> {
  return execute('run', ctx, worker)
}

export function collect(ctx: ContextRPC, worker: VitestWorker): Promise<void> {
  return execute('collect', ctx, worker)
}

export async function teardown(): Promise<void> {
  await Promise.all([...globalListeners].map(l => l()))
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
