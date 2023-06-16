import {
  getSafeTimers,
} from '@vitest/utils'
import type { BirpcReturn } from 'birpc'
import { getWorkerState } from '../utils/global'
import type { RuntimeRPC } from '#types'

const { get } = Reflect
const safeRandom = Math.random

function withSafeTimers(fn: () => void) {
  const { setTimeout, clearTimeout, nextTick, setImmediate, clearImmediate } = getSafeTimers()

  const currentSetTimeout = globalThis.setTimeout
  const currentClearTimeout = globalThis.clearTimeout
  const currentRandom = globalThis.Math.random
  const currentNextTick = globalThis.process.nextTick
  const currentSetImmediate = globalThis.setImmediate
  const currentClearImmediate = globalThis.clearImmediate

  try {
    globalThis.setTimeout = setTimeout
    globalThis.clearTimeout = clearTimeout
    globalThis.Math.random = safeRandom
    globalThis.process.nextTick = nextTick
    globalThis.setImmediate = setImmediate
    globalThis.clearImmediate = clearImmediate

    const result = fn()
    return result
  }
  finally {
    globalThis.setTimeout = currentSetTimeout
    globalThis.clearTimeout = currentClearTimeout
    globalThis.Math.random = currentRandom
    globalThis.setImmediate = currentSetImmediate
    globalThis.clearImmediate = currentClearImmediate
    nextTick(() => {
      globalThis.process.nextTick = currentNextTick
    })
  }
}

const promises = new Set<Promise<unknown>>()

export async function rpcDone() {
  if (!promises.size)
    return
  const awaitable = Array.from(promises)
  return Promise.all(awaitable)
}

export function rpc(): BirpcReturn<RuntimeRPC> {
  const { rpc } = getWorkerState()
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
