import type { Profiler } from 'node:inspector'
import type { CoverageProviderModule } from 'vitest/node'
import type { ScriptCoverageWithOffset, V8CoverageProvider } from './provider'
import inspector from 'node:inspector/promises'
import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { provider } from 'std-env'
import { loadProvider } from './load-provider'

const session = new inspector.Session()
let enabled = false

const mod: CoverageProviderModule = {
  async startCoverage({ isolate }) {
    if (isolate === false && enabled) {
      return
    }

    enabled = true

    session.connect()
    await session.post('Profiler.enable')
    await session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true })
  },

  async takeCoverage(options): Promise<{ result: ScriptCoverageWithOffset[] }> {
    if (provider === 'stackblitz') {
      return { result: [] }
    }

    const coverage = await session.post('Profiler.takePreciseCoverage')
    const result: ScriptCoverageWithOffset[] = []

    // Reduce amount of data sent over rpc by doing some early result filtering
    for (const entry of coverage.result) {
      if (filterResult(entry)) {
        result.push({
          ...entry,
          startOffset: options?.moduleExecutionInfo?.get(normalize(fileURLToPath(entry.url)))?.startOffset || 0,
        })
      }
    }

    return { result }
  },

  async stopCoverage({ isolate }) {
    if (isolate === false) {
      return
    }

    await session.post('Profiler.stopPreciseCoverage')
    await session.post('Profiler.disable')
    session.disconnect()
  },

  async getProvider(): Promise<V8CoverageProvider> {
    return loadProvider()
  },
}
export default mod

function filterResult(coverage: Profiler.ScriptCoverage): boolean {
  if (!coverage.url.startsWith('file://')) {
    return false
  }

  if (coverage.url.includes('/node_modules/')) {
    return false
  }

  if (coverage.url.includes('/@id/@vitest/')) {
    return false
  }

  if (coverage.url.includes('/@vite/client')) {
    return false
  }

  return true
}
