import type { CoverageOptions } from '../../types'
import type { BaseCoverageProvider } from './base'
import { C8CoverageProvider } from './c8'
import { NullCoverageProvider } from './NullCoverageProvider'

const CoverageProviderMap: Record<
  NonNullable<CoverageOptions['provider']>,
  { new(): BaseCoverageProvider; getCoverage(): any }
> = {
  c8: C8CoverageProvider,
}

export function getCoverageProvider(options?: CoverageOptions): BaseCoverageProvider {
  if (options?.enabled && options?.provider) {
    const CoverageProvider = CoverageProviderMap[options.provider]

    return new CoverageProvider()
  }

  return new NullCoverageProvider()
}

export function getCoverageInsideWorker(options: CoverageOptions) {
  if (options.enabled && options.provider) {
    const CoverageProvider = CoverageProviderMap[options.provider]

    return CoverageProvider.getCoverage()
  }
}
