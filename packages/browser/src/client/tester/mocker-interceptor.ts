import type { ModuleMockerInterceptor } from '@vitest/mocker/browser'
import type { MockImportMapRule } from '../../types'
import type { BrowserRPC } from '../client'
import { getBrowserState, getWorkerState } from '../utils'

export function createModuleMockerInterceptor(): ModuleMockerInterceptor {
  const mockUrls = new Map<string, string>()
  return {
    async register(module, importer) {
      const { sessionId } = getBrowserState()
      const rule = await rpc().registerMock(sessionId, module.toJSON(), {
        importer,
        testFile: getWorkerState().filepath,
      })
      if (rule) {
        mockUrls.set(module.url, appendImportMapRule(rule))
      }
    },
    async delete(id) {
      const state = getBrowserState()
      mockUrls.delete(id)
      await rpc().unregisterMock(state.sessionId, id)
    },
    async invalidate() {
      const state = getBrowserState()
      mockUrls.clear()
      await rpc().clearMocks(state.sessionId)
    },
    getMockUrl(url) {
      return mockUrls.get(url)
    },
  }
}

// the browser drops a rule for a module that the document already resolved
// and only prints a console warning, so check that the rule took effect
function appendImportMapRule({ specifier, url }: MockImportMapRule): string {
  const script = document.createElement('script')
  script.type = 'importmap'
  script.textContent = JSON.stringify({ imports: { [specifier]: url } })
  document.head.append(script)
  const mockUrl = new URL(url, location.href).href
  if (import.meta.resolve(specifier) !== mockUrl) {
    throw new Error(
      `Cannot mock "${specifier}" with an import map because the browser kept its original URL. ` +
        `The module was already imported before vi.mock was registered, ` +
        `for example by a setup file or by an earlier test file when "isolate" is false.`,
    )
  }
  return mockUrl
}

function rpc(): BrowserRPC {
  return getWorkerState().rpc as any as BrowserRPC
}
