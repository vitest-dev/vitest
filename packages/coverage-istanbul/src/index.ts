import { COVERAGE_STORE_KEY } from './constants'

export async function getProvider() {
  const { IstanbulCoverageProvider } = await import('./provider')
  return new IstanbulCoverageProvider()
}

export function takeCoverage() {
  // @ts-expect-error -- untyped global
  return globalThis[COVERAGE_STORE_KEY]
}
