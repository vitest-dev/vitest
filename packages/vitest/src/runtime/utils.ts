import type { CancelReason } from '@vitest/runner'
import type { BirpcOptions, BirpcReturn } from 'birpc'
import type { EvaluatedModules } from 'vite/module-runner'

import type { RunnerRPC, RuntimeRPC } from '../types/rpc'
import type { WorkerGlobalState, WorkerRPC } from '../types/worker'
import { getSafeTimers } from '@vitest/utils'
import { createBirpc } from 'birpc'

const NAME_WORKER_STATE = '__vitest_worker__'

export function getWorkerState(): WorkerGlobalState {
  // @ts-expect-error untyped global
  const workerState = globalThis[NAME_WORKER_STATE]
  if (!workerState) {
    const errorMsg
      = 'Vitest failed to access its internal state.'
        + '\n\nOne of the following is possible:'
        + '\n- "vitest" is imported directly without running "vitest" command'
        + '\n- "vitest" is imported inside "globalSetup" (to fix this, use "setupFiles" instead, because "globalSetup" runs in a different context)'
        + '\n- "vitest" is imported inside Vite / Vitest config file'
        + '\n- Otherwise, it might be a Vitest bug. Please report it to https://github.com/vitest-dev/vitest/issues\n'
    throw new Error(errorMsg)
  }
  return workerState
}

export function provideWorkerState(context: any, state: WorkerGlobalState): WorkerGlobalState {
  Object.defineProperty(context, NAME_WORKER_STATE, {
    value: state,
    configurable: true,
    writable: true,
    enumerable: false,
  })

  return state
}

export function isChildProcess(): boolean {
  return typeof process !== 'undefined' && !!process.send
}

export function resetModules(modules: EvaluatedModules, resetMocks = false): void {
  const skipPaths = [
    // Vitest
    /\/vitest\/dist\//,
    // yarn's .store folder
    /vitest-virtual-\w+\/dist/,
    // cnpm
    /@vitest\/dist/,
    // don't clear mocks
    ...(!resetMocks ? [/^mock:/] : []),
  ]
  modules.idToModuleMap.forEach((node, path) => {
    if (skipPaths.some(re => re.test(path))) {
      return
    }

    node.promise = undefined
    node.exports = undefined
    node.evaluated = false
    node.importers.clear()
  })
}

function waitNextTick() {
  const { setTimeout } = getSafeTimers()
  return new Promise(resolve => setTimeout(resolve, 0))
}

export async function waitForImportsToResolve(): Promise<void> {
  await waitNextTick()
  const state = getWorkerState()
  const promises: Promise<unknown>[] = []
  const resolvingCount = state.resolvingModules.size
  for (const [_, mod] of state.evaluatedModules.idToModuleMap) {
    if (mod.promise && !mod.evaluated) {
      promises.push(mod.promise)
    }
  }
  if (!promises.length && !resolvingCount) {
    return
  }
  await Promise.allSettled(promises)
  await waitForImportsToResolve()
}

const { get } = Reflect

function withSafeTimers(fn: () => void) {
  const { setTimeout, clearTimeout, nextTick, setImmediate, clearImmediate }
    = getSafeTimers()

  const currentSetTimeout = globalThis.setTimeout
  const currentClearTimeout = globalThis.clearTimeout
  const currentSetImmediate = globalThis.setImmediate
  const currentClearImmediate = globalThis.clearImmediate

  const currentNextTick = globalThis.process?.nextTick

  try {
    globalThis.setTimeout = setTimeout
    globalThis.clearTimeout = clearTimeout

    if (setImmediate) {
      globalThis.setImmediate = setImmediate
    }
    if (clearImmediate) {
      globalThis.clearImmediate = clearImmediate
    }

    if (globalThis.process && nextTick) {
      globalThis.process.nextTick = nextTick
    }

    const result = fn()
    return result
  }
  finally {
    globalThis.setTimeout = currentSetTimeout
    globalThis.clearTimeout = currentClearTimeout
    globalThis.setImmediate = currentSetImmediate
    globalThis.clearImmediate = currentClearImmediate

    if (globalThis.process && nextTick) {
      nextTick(() => {
        globalThis.process.nextTick = currentNextTick
      })
    }
  }
}

const promises = new Set<Promise<unknown>>()

export async function rpcDone(): Promise<unknown[] | undefined> {
  if (!promises.size) {
    return
  }
  const awaitable = Array.from(promises)
  return Promise.all(awaitable)
}

export function createRuntimeRpc(
  options: Pick<
    BirpcOptions<RuntimeRPC>,
    'on' | 'post' | 'serialize' | 'deserialize'
  >,
): { rpc: WorkerRPC; onCancel: Promise<CancelReason> } {
  let setCancel = (_reason: CancelReason) => {}
  const onCancel = new Promise<CancelReason>((resolve) => {
    setCancel = resolve
  })

  const rpc = createSafeRpc(
    createBirpc<RuntimeRPC, RunnerRPC>(
      {
        onCancel: setCancel,
      },
      {
        eventNames: [
          'onUserConsoleLog',
          'onCollected',
          'onCancel',
        ],
        timeout: -1,
        ...options,
      },
    ),
  )

  return {
    rpc,
    onCancel,
  }
}

export function createSafeRpc(rpc: WorkerRPC): WorkerRPC {
  return new Proxy(rpc, {
    get(target, p, handler) {
      // keep $rejectPendingCalls as sync function
      if (p === '$rejectPendingCalls') {
        return rpc.$rejectPendingCalls
      }

      const sendCall = get(target, p, handler)
      const safeSendCall = (...args: any[]) =>
        withSafeTimers(async () => {
          const result = sendCall(...args)
          promises.add(result)
          try {
            return await result
          }
          finally {
            promises.delete(result)
          }
        })
      safeSendCall.asEvent = sendCall.asEvent
      return safeSendCall
    },
  })
}

export function rpc(): BirpcReturn<RuntimeRPC, RunnerRPC> {
  const { rpc } = getWorkerState()
  return rpc
}
