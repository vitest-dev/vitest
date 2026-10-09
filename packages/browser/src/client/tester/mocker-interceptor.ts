import type { ModuleMockerInterceptor } from '@vitest/mocker/browser'
import type { MockImportMap } from '../../types'
import type { BrowserRPC } from '../client'
import { getBrowserState, getWorkerState } from '../utils'

export function createModuleMockerInterceptor(): ModuleMockerInterceptor {
  return {
    async register(module) {
      const state = getBrowserState()
      const importMap = await rpc().registerMock(state.sessionId, module.toJSON())
      if (importMap) {
        appendImportMap(importMap)
      }
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

// the browser drops a rule for a module that the document already resolved
// and only prints a console warning, so check that every rule took effect
function appendImportMap(importMap: MockImportMap) {
  const script = document.createElement('script')
  script.type = 'importmap'
  script.textContent = JSON.stringify(importMap)
  document.head.append(script)
  for (const [specifier, url] of Object.entries(importMap.imports)) {
    const expected = new URL(url, location.href).href
    if (import.meta.resolve(specifier) !== expected) {
      throw new Error(
        `Cannot mock "${specifier}" with an import map because the browser kept its original URL. ` +
          `Either the module was already imported before vi.mock was registered, ` +
          `or the browser does not support adding an import map after a module was loaded.`,
      )
    }
  }
}

function rpc(): BrowserRPC {
  return getWorkerState().rpc as any as BrowserRPC
}
