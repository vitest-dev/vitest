import {
  getSafeTimers,
} from '@vitest/utils'
import { getWorkerState } from '../utils'

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
    nextTick(() => {
      globalThis.setTimeout = currentSetTimeout
      globalThis.clearTimeout = currentClearTimeout
      globalThis.Math.random = currentRandom
      globalThis.process.nextTick = currentNextTick
      globalThis.setImmediate = currentSetImmediate
      globalThis.clearImmediate = currentClearImmediate
    })
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
