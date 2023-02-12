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

export const rpc = () => {
  const { rpc } = getWorkerState()
  return new Proxy(rpc, {
    get(target, p, handler) {
      const sendCall = Reflect.get(target, p, handler)
      const safeSendCall = (...args: any[]) => withSafeTimers(() => sendCall(...args))
      safeSendCall.asEvent = sendCall.asEvent
      return safeSendCall
    },
  })
}
