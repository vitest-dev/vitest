import * as coverage from './takeCoverage'
import type { V8CoverageProvider } from './provider'

export default {
  startCoverage(): void {
    return coverage.startCoverage()
  },
  takeCoverage(): Promise<unknown> {
    return coverage.takeCoverage()
  },
  stopCoverage(): void {
    return coverage.stopCoverage()
  },
  async getProvider(): Promise<V8CoverageProvider> {
    // to not bundle the provider
    const name = './provider.js'
    const { V8CoverageProvider } = (await import(
      name
    )) as typeof import('./provider')
    return new V8CoverageProvider()
  },
}
