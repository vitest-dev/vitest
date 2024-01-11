import type {
  getSafeTimers,
} from '@vitest/utils'
import type { VitestClient } from '@vitest/ws-client'

const { get } = Reflect

function withSafeTimers(getTimers: typeof getSafeTimers, fn: () => void) {
  const { setTimeout, clearTimeout, setImmediate, clearImmediate } = getTimers()

  const currentSetTimeout = globalThis.setTimeout
  const currentClearTimeout = globalThis.clearTimeout
  const currentSetImmediate = globalThis.setImmediate
  const currentClearImmediate = globalThis.clearImmediate

  try {
    globalThis.setTimeout = setTimeout
    globalThis.clearTimeout = clearTimeout
    globalThis.setImmediate = setImmediate
    globalThis.clearImmediate = clearImmediate

    const result = fn()
    return result
  }
  finally {
    globalThis.setTimeout = currentSetTimeout
    globalThis.clearTimeout = currentClearTimeout
    globalThis.setImmediate = currentSetImmediate
    globalThis.clearImmediate = currentClearImmediate
  }
}

const promises = new Set<Promise<unknown>>()

export async function rpcDone() {
  if (!promises.size)
    return
  const awaitable = Array.from(promises)
  return Promise.all(awaitable)
}

export function createSafeRpc(client: VitestClient, getTimers: () => any): VitestClient['rpc'] {
  return new Proxy(client.rpc, {
    get(target, p, handler) {
      const sendCall = get(target, p, handler)
      const safeSendCall = (...args: any[]) => withSafeTimers(getTimers, async () => {
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

export function rpc(): VitestClient['rpc'] {
  // @ts-expect-error not typed global
  return globalThis.__vitest_worker__.safeRpc
}
