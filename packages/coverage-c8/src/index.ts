import * as coverage from './takeCoverage'

export default {
  ...coverage,
  async getProvider() {
    // to not bundle the provider
    const name = './provider.js'
    const { C8CoverageProvider } = await import(name) as typeof import('./provider')
    return new C8CoverageProvider()
  },
}
