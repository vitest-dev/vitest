import type { CoverageProviderModule } from 'vitest/node'
import type { V8CoverageProvider } from './provider'
import { cdp } from '@vitest/browser/context'
import { loadProvider } from './load-provider'

const session = cdp()
let enabled = false

type ScriptCoverage = Awaited<ReturnType<typeof session.send<'Profiler.takePreciseCoverage'>>>

export default {
  async startCoverage() {
    if (enabled) {
      return
    }

    enabled = true

    await session.send('Profiler.enable')
    await session.send('Profiler.startPreciseCoverage', {
      callCount: true,
      detailed: true,
    })
  },

  async takeCoverage(): Promise<{ result: any[] }> {
    const coverage = await session.send('Profiler.takePreciseCoverage')
    const result: typeof coverage.result = []

    // Reduce amount of data sent over rpc by doing some early result filtering
    for (const entry of coverage.result) {
      if (filterResult(entry)) {
        result.push({
          ...entry,
          url: decodeURIComponent(entry.url.replace(window.location.origin, '')),
        })
      }
    }

    return { result }
  },

  stopCoverage() {
    // Browser mode should not stop coverage as same V8 instance is shared between tests
  },

  async getProvider(): Promise<V8CoverageProvider> {
    return loadProvider()
  },
} satisfies CoverageProviderModule

function filterResult(coverage: ScriptCoverage['result'][number]): boolean {
  if (!coverage.url.startsWith(window.location.origin)) {
    return false
  }

  if (coverage.url.includes('/node_modules/')) {
    return false
  }

  if (coverage.url.includes('__vitest_browser__')) {
    return false
  }

  if (coverage.url.includes('__vitest__/assets')) {
    return false
  }

  if (coverage.url === window.location.href) {
    return false
  }

  if (coverage.url.includes('?browserv=') || coverage.url.includes('&browserv=')) {
    return false
  }

  return true
}
