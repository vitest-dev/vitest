import type {
  getSafeTimers,
} from '@vitest/utils'
import type { VitestClient } from '@vitest/ws-client'
import { importId } from './utils'

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
      if (p === 'then')
        return
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

function serializeError(unhandledError: any) {
  return {
    ...unhandledError,
    name: unhandledError.name,
    message: unhandledError.message,
    stack: String(unhandledError.stack),
  }
}

const url = new URL(location.href)
const reloadTries = Number(url.searchParams.get('reloadTries') || '0')

export async function loadSafeRpc(client: VitestClient) {
  let safeRpc: typeof client.rpc
  try {
    // if importing /@id/ failed, we reload the page waiting until Vite prebundles it
    const { getSafeTimers } = await importId('vitest/utils') as typeof import('vitest/utils')
    safeRpc = createSafeRpc(client, getSafeTimers)
  }
  catch (err: any) {
    if (reloadTries >= 10) {
      const error = serializeError(new Error('Vitest failed to load "vitest/utils" after 10 retries.'))
      error.cause = serializeError(err)

      throw error
    }

    const tries = reloadTries + 1
    const newUrl = new URL(location.href)
    newUrl.searchParams.set('reloadTries', String(tries))
    location.href = newUrl.href
    return
  }
  return safeRpc
}

export function rpc(): VitestClient['rpc'] {
  // @ts-expect-error not typed global
  return globalThis.__vitest_worker__.rpc
}
