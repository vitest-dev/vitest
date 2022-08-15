import { importModule } from 'local-pkg'
import type { CoverageOptions, CoverageProvider, CoverageProviderModule } from '../types'

export const CoverageProviderMap = {
  c8: '@vitest/coverage-c8',
  istanbul: '@vitest/coverage-istanbul',
}

export async function getCoverageProvider(options?: CoverageOptions): Promise<CoverageProvider | null> {
  if (options?.enabled && options?.provider) {
    const { getProvider } = await importModule<CoverageProviderModule>(CoverageProviderMap[options.provider])
    return await getProvider()
  }
  return null
}

export async function takeCoverageInsideWorker(options: CoverageOptions) {
  if (options.enabled && options.provider) {
    const { takeCoverage } = await importModule<CoverageProviderModule>(CoverageProviderMap[options.provider])
    return await takeCoverage?.()
  }
}
