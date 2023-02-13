import {
  getSafeTimers,
} from '@vitest/utils'
import { getWorkerState } from '../utils'

const safeRandom = Math.random

function withSafeTimers(fn: () => void) {
  const { setTimeout: safeSetTimeout } = getSafeTimers()
  const currentSetTimeout = globalThis.setTimeout
  const currentRandom = globalThis.Math.random

  try {
    globalThis.setTimeout = safeSetTimeout
    globalThis.Math.random = safeRandom

    const result = fn()
    return result
  }
  finally {
    globalThis.setTimeout = currentSetTimeout
    globalThis.Math.random = currentRandom
  }
}

const promises = new Set<Promise<unknown>>()

export const rpcDone = () => {
  if (!promises.size)
    return
  const awaitable = Array.from(promises)
  return Promise.all(awaitable)
}

export const rpc = () => {
  const { rpc } = getWorkerState()
  return new Proxy(rpc, {
    get(target, p, handler) {
      const sendCall = Reflect.get(target, p, handler)
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
