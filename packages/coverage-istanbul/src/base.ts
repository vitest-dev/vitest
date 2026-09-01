import type { CoverageMapData } from '@vitest/istanbul-lib-coverage'
import type { IstanbulCoverageProvider } from './provider'
import { COVERAGE_STORE_KEY } from './constants'

export const BaseCoverageProviderModule = {
  takeCoverage(): CoverageMapData | undefined {
    // @ts-expect-error -- untyped global
    const coverageMap = globalThis[COVERAGE_STORE_KEY] as CoverageMapData | undefined

    if (!coverageMap) {
      return
    }

    // isolate:false keeps many files in one run request. takeCoverage runs
    // after each file; without a snapshot+reset the next take still holds
    // earlier hits and merge double-counts them.
    const snapshot = structuredClone(coverageMap)
    this.startCoverage()
    return snapshot
  },

  // Reset coverage map to prevent duplicate results if this is called twice in row
  startCoverage(): void {
    // @ts-expect-error -- untyped global
    const coverageMap = globalThis[COVERAGE_STORE_KEY] as CoverageMapData

    // When isolated, there are no previous results
    if (!coverageMap) {
      return
    }

    for (const filename in coverageMap) {
      const branches = coverageMap[filename].b

      for (const key in branches) {
        branches[key] = branches[key].map(() => 0)
      }

      for (const metric of ['f', 's'] as const) {
        const entry = coverageMap[filename][metric]

        for (const key in entry) {
          entry[key] = 0
        }
      }
    }
  },

  async getProvider(): Promise<IstanbulCoverageProvider> {
    // to not bundle the provider
    const providerPath = './provider.js'
    const { IstanbulCoverageProvider } = (await import(
      /* @vite-ignore */
      providerPath,
    )) as typeof import('./provider')

    return new IstanbulCoverageProvider()
  },
}
