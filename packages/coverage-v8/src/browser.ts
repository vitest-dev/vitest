import type { Profiler } from 'node:inspector'
import type { CoverageProviderModule } from 'vitest/node'
import type { V8CoverageProvider } from './provider'
import { loadProvider } from './load-provider'

let enabled = false

type ScriptCoverage = Profiler.TakePreciseCoverageReturnType

function triggerCommand(command: string, args: any[] = []): Promise<any> {
  return (globalThis as any).__vitest_browser_runner__.commands.triggerCommand(command, args)
}

const mod: CoverageProviderModule = {
  async startCoverage() {
    if (enabled) {
      return
    }

    enabled = true

    await triggerCommand('__vitest_startV8Coverage')
  },

  async takeCoverage(): Promise<{ result: any[] }> {
    const coverage: ScriptCoverage = await triggerCommand('__vitest_takeV8Coverage')
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
}
export default mod

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

  return true
}
