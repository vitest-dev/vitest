import { importModule } from 'local-pkg'
import type { CoverageOptions, CoverageProvider, CoverageProviderModule } from '../types'

export const CoverageProviderMap = {
  c8: '@vitest/coverage-c8',
  istanbul: '@vitest/coverage-istanbul',
}

export async function resolveCoverageProvider(provider: NonNullable<CoverageOptions['provider']>) {
  if (typeof provider === 'string') {
    const pkg = CoverageProviderMap[provider]
    if (!pkg)
      throw new Error(`Unknown coverage provider: ${provider}`)
    return await importModule<CoverageProviderModule>(pkg)
  }
  else {
    return provider
  }
}

export async function getCoverageProvider(options?: CoverageOptions): Promise<CoverageProvider | null> {
  if (options?.enabled && options?.provider) {
    const { getProvider } = await resolveCoverageProvider(options.provider)
    return await getProvider()
  }
  return null
}

export async function takeCoverageInsideWorker(options: CoverageOptions) {
  if (options.enabled && options.provider) {
    const { takeCoverage } = await resolveCoverageProvider(options.provider)
    return await takeCoverage?.()
  }
}
