import {
  getSafeTimers,
} from '@vitest/utils'
import { getWorkerState } from '../utils'

const { get } = Reflect
const safeRandom = Math.random

function withSafeTimers(fn: () => void) {
  const { setTimeout, clearTimeout } = getSafeTimers()

  const currentSetTimeout = globalThis.setTimeout
  const currentClearTimeout = globalThis.clearTimeout
  const currentRandom = globalThis.Math.random

  try {
    globalThis.setTimeout = setTimeout
    globalThis.clearTimeout = clearTimeout
    globalThis.Math.random = safeRandom

    const result = fn()
    return result
  }
  finally {
    globalThis.setTimeout = currentSetTimeout
    globalThis.clearTimeout = currentClearTimeout
    globalThis.Math.random = currentRandom
  }
}

export const rpc = () => {
  const { rpc } = getWorkerState()
  return new Proxy(rpc, {
    get(target, p, handler) {
      const sendCall = get(target, p, handler)
      const safeSendCall = (...args: any[]) => withSafeTimers(() => sendCall(...args))
      safeSendCall.asEvent = sendCall.asEvent
      return safeSendCall
    },
  })
}
