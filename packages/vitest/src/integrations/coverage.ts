import { importModule } from 'local-pkg'
import type { CoverageOptions, CoverageProvider } from '../types'

export const CoverageProviderMap = {
  c8: '@vitest/coverage-c8',
  istanbul: '@vitest/coverage-istanbul',
}

export async function getCoverageProvider(options?: CoverageOptions): Promise<CoverageProvider | null> {
  if (options?.enabled && options?.provider) {
    const { default: CoverageProvider } = await importModule(CoverageProviderMap[options.provider])
    return new CoverageProvider()
  }
  return null
}

export async function getCoverageInsideWorker(options: CoverageOptions) {
  if (options.enabled && options.provider) {
    const { default: CoverageProvider } = await importModule(CoverageProviderMap[options.provider])
    return CoverageProvider?.getCoverage()
  }
}
