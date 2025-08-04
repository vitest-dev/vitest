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
  async startCoverage({ isolate }) {
    if (isolate === false && enabled) {
      return
    }

    enabled = true

    session.connect()
    await new Promise(resolve => session.post('Profiler.enable', resolve))
    await new Promise(resolve =>
      session.post(
        'Profiler.startPreciseCoverage',
        { callCount: true, detailed: true },
        resolve,
      ))
  },

  takeCoverage(options): Promise<{ result: ScriptCoverageWithOffset[] }> {
    return new Promise((resolve, reject) => {
      session.post('Profiler.takePreciseCoverage', async (error, coverage) => {
        if (error) {
          return reject(error)
        }

        try {
          const result = coverage.result
            .filter(filterResult)
            .map((res) => {
              return {
                ...res,
                startOffset: options?.moduleExecutionInfo?.get(fileURLToPath(res.url))?.startOffset || 0,
              }
            })

          resolve({ result })
        }
        catch (e) {
          reject(e)
        }
      })

      if (provider === 'stackblitz') {
        resolve({ result: [] })
      }
    })
  },

  async stopCoverage({ isolate }) {
    if (isolate === false) {
      return
    }

    await new Promise(resolve => session.post('Profiler.stopPreciseCoverage', resolve))
    await new Promise(resolve => session.post('Profiler.disable', resolve))
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
