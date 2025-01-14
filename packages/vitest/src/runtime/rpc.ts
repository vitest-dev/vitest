import type { CancelReason } from '@vitest/runner'
import type { BirpcOptions, BirpcReturn } from 'birpc'
import type { RunnerRPC, RuntimeRPC } from '../types/rpc'
import type { WorkerRPC } from '../types/worker'
import { getSafeTimers } from '@vitest/utils'
import { createBirpc } from 'birpc'
import { getWorkerState } from './utils'

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
    globalThis.setImmediate = setImmediate
    globalThis.clearImmediate = clearImmediate

    if (globalThis.process) {
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

    if (globalThis.process) {
      nextTick(() => {
        globalThis.process.nextTick = currentNextTick
      })
    }
  }
}

const promises = new Set<Promise<unknown>>()

export async function rpcDone() {
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
) {
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
        onTimeoutError(functionName, args) {
          let message = `[vitest-worker]: Timeout calling "${functionName}"`

          if (
            functionName === 'fetch'
            || functionName === 'transform'
            || functionName === 'resolveId'
          ) {
            message += ` with "${JSON.stringify(args)}"`
          }

          // JSON.stringify cannot serialize Error instances
          if (functionName === 'onUnhandledError') {
            message += ` with "${args[0]?.message || args[0]}"`
          }

          throw new Error(message)
        },
        ...options,
      },
    ),
  )

  return {
    rpc,
    onCancel,
  }
}

export function createSafeRpc(rpc: WorkerRPC) {
  return new Proxy(rpc, {
    get(target, p, handler) {
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
