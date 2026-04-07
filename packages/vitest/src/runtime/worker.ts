import type { ContextRPC, WorkerGlobalState } from '../types/worker'
import type { Traces } from '../utils/traces'
import type { VitestWorker } from './workers/types'
import { createStackString, parseStacktrace } from '@vitest/utils/source-map'
import { setupInspect } from './inspector'
import * as listeners from './listeners'
import { VitestEvaluatedModules } from './moduleRunner/evaluatedModules'
import { onCancel, rpcDone } from './rpc'
import { EnvironmentTeardownError } from './utils'

const resolvingModules = new Set<string>()

async function execute(method: 'run' | 'collect', ctx: ContextRPC, worker: VitestWorker, traces: Traces) {
  const prepareStart = performance.now()

  const cleanups: (() => void | Promise<void>)[] = [setupInspect(ctx)]

  // RPC is used to communicate between worker (be it a thread worker or child process or a custom implementation) and the main thread
  const rpc = ctx.rpc

  try {
    // do not close the RPC channel so that we can get the error messages sent to the main thread
    cleanups.push(async () => {
      await Promise.all(rpc.$rejectPendingCalls(({ method, reject }) => {
        reject(new EnvironmentTeardownError(`[vitest-worker]: Closing rpc while "${method}" was pending`))
      }))
    })

    const state = {
      ctx,
      // here we create a new one, workers can reassign this if they need to keep it non-isolated
      evaluatedModules: new VitestEvaluatedModules(),
      resolvingModules,
      moduleExecutionInfo: new Map(),
      config: ctx.config,
      // this is set later by vm or base
      environment: null!,
      durations: {
        environment: 0,
        prepare: prepareStart,
      },
      rpc,
      onCancel,
      onCleanup: listeners.onCleanup,
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

    await worker[methodName](state, traces)
  }
  finally {
    await rpcDone().catch(() => {})
    await Promise.all(cleanups.map(fn => fn())).catch(() => {})
  }
}

export function run(ctx: ContextRPC, worker: VitestWorker, traces: Traces): Promise<void> {
  return execute('run', ctx, worker, traces)
}

export function collect(ctx: ContextRPC, worker: VitestWorker, traces: Traces): Promise<void> {
  return execute('collect', ctx, worker, traces)
}

export async function teardown(): Promise<void> {
  await listeners.cleanup()
}

const env = process.env

function createImportMetaEnvProxy(): WorkerGlobalState['metaEnv'] {
  // packages/vitest/src/node/plugins/index.ts:146
  const booleanKeys = ['DEV', 'PROD', 'SSR']
  return new Proxy(env, {
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
