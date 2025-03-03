import type { ModuleMockerInterceptor } from '@vitest/mocker/browser'
import type { BrowserRPC } from '../client'
import { getBrowserState, getWorkerState } from '../utils'

export function createModuleMockerInterceptor(): ModuleMockerInterceptor {
  return {
    async register(module) {
      const state = getBrowserState()
      await rpc().registerMock(state.sessionId, module.toJSON())
    },
    async delete(id) {
      const state = getBrowserState()
      await rpc().unregisterMock(state.sessionId, id)
    },
    async invalidate() {
      const state = getBrowserState()
      await rpc().clearMocks(state.sessionId)
    },
  }
}

export function rpc(): BrowserRPC {
  return getWorkerState().rpc as any as BrowserRPC
}
