import { importModule } from 'local-pkg'
import type { CoverageOptions, CoverageProvider } from '../../types'

const providerMap = {
  c8: '@vitest/coverage-c8',
  istanbul: '@vitest/coverage-istanbul',
}

export async function getCoverageProvider(options?: CoverageOptions): Promise<CoverageProvider | undefined> {
  if (options?.enabled && options?.provider) {
    const { default: CoverageProvider } = await importModule(providerMap[options.provider])
    return new CoverageProvider()
  }
  return undefined
}

export async function getCoverageInsideWorker(options: CoverageOptions) {
  if (options.enabled && options.provider) {
    const { default: CoverageProvider } = await importModule(providerMap[options.provider])
    return CoverageProvider?.getCoverage()
  }
}
