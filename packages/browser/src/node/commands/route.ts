import type { BrowserCommand } from 'vitest/node'

export type SerializedRouteMatcher
  = | { type: 'string'; value: string }
    | { type: 'regexp'; value: string; flags: string }

export interface RouteRegisterPayload {
  id: string
  matcher: SerializedRouteMatcher
}

interface RouteCapableProvider {
  registerRoute?: (sessionId: string, payload: RouteRegisterPayload) => Promise<void>
  unregisterRoute?: (sessionId: string, id: string) => Promise<void>
  resetRoutes?: (sessionId: string) => Promise<void>
}

export const register: BrowserCommand<[RouteRegisterPayload]> = async (context, payload) => {
  const provider = context.provider as RouteCapableProvider
  if (!provider.registerRoute) {
    throw new Error('The current browser provider does not support route interception.')
  }
  await provider.registerRoute(context.sessionId, payload)
}

export const unregister: BrowserCommand<[string]> = async (context, id) => {
  const provider = context.provider as RouteCapableProvider
  if (!provider.unregisterRoute) {
    throw new Error('The current browser provider does not support route interception.')
  }
  await provider.unregisterRoute(context.sessionId, id)
}

export const reset: BrowserCommand<[]> = async (context) => {
  const provider = context.provider as RouteCapableProvider
  if (!provider.resetRoutes) {
    throw new Error('The current browser provider does not support route interception.')
  }
  await provider.resetRoutes(context.sessionId)
}
