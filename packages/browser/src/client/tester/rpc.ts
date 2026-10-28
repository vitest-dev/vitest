import type { VitestBrowserClient } from '@vitest/browser/client'
import { getSafeTimers } from 'vitest/internal/browser'
import { flushLogs } from './logger'

const { get } = Reflect

function withSafeTimers(getTimers: typeof getSafeTimers, fn: () => void) {
  const { setTimeout, clearTimeout } = getTimers()

  const currentSetTimeout = globalThis.setTimeout
  const currentClearTimeout = globalThis.clearTimeout

  try {
    globalThis.setTimeout = setTimeout
    globalThis.clearTimeout = clearTimeout

    const result = fn()
    return result
  } finally {
    globalThis.setTimeout = currentSetTimeout
    globalThis.clearTimeout = currentClearTimeout
  }
}

const promises = new Set<Promise<unknown>>()

export function createSafeRpc(client: VitestBrowserClient): VitestBrowserClient['rpc'] {
  return new Proxy(client.rpc, {
    get(target, p, handler) {
      if (p === 'then') {
        return
      }
      const sendCall = get(target, p, handler)
      const safeSendCall = (...args: any[]) =>
        withSafeTimers(getSafeTimers, async () => {
          // send the logs written before this call ahead of it
          if (p !== 'sendLog') {
            flushLogs()
          }
          const result = sendCall(...args)
          promises.add(result)
          try {
            return await result
          } finally {
            promises.delete(result)
          }
        })
      safeSendCall.asEvent = sendCall.asEvent
      return safeSendCall
    },
  })
}

export function rpc(): VitestBrowserClient['rpc'] {
  // @ts-expect-error not typed global
  return globalThis.__vitest_worker__.rpc
}
