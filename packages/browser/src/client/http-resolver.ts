import type { BrowserResponseResolver } from 'vitest/browser'
import type { SerializedHttpResponse } from '../types'

interface ResolverStore {
  map: Map<string, BrowserResponseResolver>
  counter: number
}

function getStore(): ResolverStore {
  const globalThisTyped = globalThis as typeof globalThis & {
    __vitest_http_resolvers__?: ResolverStore
  }
  if (!globalThisTyped.__vitest_http_resolvers__) {
    globalThisTyped.__vitest_http_resolvers__ = {
      map: new Map<string, BrowserResponseResolver>(),
      counter: 0,
    }
  }
  return globalThisTyped.__vitest_http_resolvers__
}

export function registerHttpResolver(resolver: BrowserResponseResolver): string {
  const store = getStore()
  const id = `${++store.counter}`
  store.map.set(id, resolver)
  return id
}

export async function runHttpResolver(
  resolverId: string,
): Promise<SerializedHttpResponse> {
  const store = getStore()
  const resolver = store.map.get(resolverId)
  if (!resolver) {
    throw new Error(`HTTP resolver "${resolverId}" is not registered.`)
  }

  const response = await resolver()

  const body = await response.text()

  return {
    status: response.status,
    headers: Array.from(response.headers.entries()),
    body,
  }
}
