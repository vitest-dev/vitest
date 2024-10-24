import type { IstanbulCoverageProvider } from './provider'
import { COVERAGE_STORE_KEY } from './constants'

export async function getProvider(): Promise<IstanbulCoverageProvider> {
  // to not bundle the provider
  const providerPath = './provider.js'
  const { IstanbulCoverageProvider } = (await import(
    /* @vite-ignore */
    providerPath
  )) as typeof import('./provider')
  return new IstanbulCoverageProvider()
}

export function takeCoverage(): any {
  // @ts-expect-error -- untyped global
  const coverage = globalThis[COVERAGE_STORE_KEY]

  // Reset coverage map to prevent duplicate results if this is called twice in row
  // @ts-expect-error -- untyped global
  globalThis[COVERAGE_STORE_KEY] = {}

  return coverage
}

const _default: {
  getProvider: () => Promise<IstanbulCoverageProvider>
  takeCoverage: () => any
} = {
  getProvider,
  takeCoverage,
}

export default _default
