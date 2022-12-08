import { COVERAGE_STORE_KEY } from './constants'

export async function getProvider() {
  const { IstanbulCoverageProvider } = await import('./provider')
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
