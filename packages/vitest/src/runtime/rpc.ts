import {
  getSafeTimers,
} from '@vitest/utils'
import type { BirpcReturn } from 'birpc'
import { getWorkerState } from '../utils/global'
import type { RuntimeRPC } from '../types/rpc'
import type { WorkerRPC } from '../types'

const { get } = Reflect

function withSafeTimers(fn: () => void) {
  const { setTimeout, clearTimeout, nextTick, hrtime, setImmediate, clearImmediate, queueMicrotask } = getSafeTimers()

  const currentSetTimeout = globalThis.setTimeout
  const currentClearTimeout = globalThis.clearTimeout
  const currentSetImmediate = globalThis.setImmediate
  const currentClearImmediate = globalThis.clearImmediate
  const currentQueueMicrotask = globalThis.queueMicrotask

  const currentNextTick = globalThis.process?.nextTick
  const currentHrtime = globalThis.process?.hrtime

  try {
    globalThis.setTimeout = setTimeout
    globalThis.clearTimeout = clearTimeout
    globalThis.setImmediate = setImmediate
    globalThis.clearImmediate = clearImmediate
    globalThis.queueMicrotask = queueMicrotask

    if (globalThis.process) {
      globalThis.process.nextTick = nextTick
      globalThis.process.hrtime = hrtime
    }

    const result = fn()
    return result
  }
  finally {
    globalThis.setTimeout = currentSetTimeout
    globalThis.clearTimeout = currentClearTimeout
    globalThis.setImmediate = currentSetImmediate
    globalThis.clearImmediate = currentClearImmediate

    if (globalThis.queueMicrotask) {
      queueMicrotask(() => {
        globalThis.queueMicrotask = currentQueueMicrotask
      })
    }

    if (globalThis.process) {
      nextTick(() => {
        globalThis.process.hrtime = currentHrtime
        globalThis.process.nextTick = currentNextTick
      })
    }
  }
}

const promises = new Set<Promise<unknown>>()

export async function rpcDone() {
  if (!promises.size)
    return
  const awaitable = Array.from(promises)
  return Promise.all(awaitable)
}

export function createSafeRpc(rpc: WorkerRPC) {
  return new Proxy(rpc, {
    get(target, p, handler) {
      const sendCall = get(target, p, handler)
      const safeSendCall = (...args: any[]) => withSafeTimers(async () => {
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

export function rpc(): BirpcReturn<RuntimeRPC> {
  const { rpc } = getWorkerState()
  return rpc
}
