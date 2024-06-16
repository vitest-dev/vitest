import { COVERAGE_STORE_KEY } from './constants'

export async function getProvider() {
  // to not bundle the provider
  const providerPath = './provider.js'
  const { IstanbulCoverageProvider } = (await import(
    providerPath
  )) as typeof import('./provider')
  return new IstanbulCoverageProvider()
}

export function takeCoverage() {
  // @ts-expect-error -- untyped global
  const coverage = globalThis[COVERAGE_STORE_KEY]

  // Reset coverage map to prevent duplicate results if this is called twice in row
  // @ts-expect-error -- untyped global
  globalThis[COVERAGE_STORE_KEY] = {}

  return coverage
}

export default {
  getProvider,
  takeCoverage,
}
