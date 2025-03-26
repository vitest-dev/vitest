import type { Profiler } from 'node:inspector'
import type { CoverageProviderModule } from 'vitest/node'
import type { ScriptCoverageWithOffset, V8CoverageProvider } from './provider'
import inspector from 'node:inspector'
import { fileURLToPath } from 'node:url'
import { provider } from 'std-env'
import { loadProvider } from './load-provider'

const session = new inspector.Session()
let enabled = false

const mod: CoverageProviderModule = {
  startCoverage({ isolate }) {
    if (isolate === false && enabled) {
      return
    }

    enabled = true

    session.connect()
    session.post('Profiler.enable')
    session.post('Profiler.startPreciseCoverage', {
      callCount: true,
      detailed: true,
    })
  },

  takeCoverage(options): Promise<{ result: ScriptCoverageWithOffset[] }> {
    return new Promise((resolve, reject) => {
      session.post('Profiler.takePreciseCoverage', async (error, coverage) => {
        if (error) {
          return reject(error)
        }

        const result = coverage.result
          .filter(filterResult)
          .map(res => ({
            ...res,
            startOffset: options?.moduleExecutionInfo?.get(fileURLToPath(res.url))?.startOffset || 0,
          }))

        resolve({ result })
      })

      if (provider === 'stackblitz') {
        resolve({ result: [] })
      }
    })
  },

  stopCoverage({ isolate }) {
    if (isolate === false) {
      return
    }

    session.post('Profiler.stopPreciseCoverage')
    session.post('Profiler.disable')
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

  return true
}
