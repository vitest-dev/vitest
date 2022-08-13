import type { CoverageOptions } from '../../types'
import type { CoverageProvider } from './base'
import { C8CoverageProvider } from './c8'
import { IstanbulCoverageProvider } from './istanbul'

const CoverageProviderMap: Record<
  NonNullable<CoverageOptions['provider']>,
  { new(): CoverageProvider; getCoverage(): any }
> = {
  c8: C8CoverageProvider,
  istanbul: IstanbulCoverageProvider,
}

export function getCoverageProvider(options?: CoverageOptions): CoverageProvider | undefined {
  if (options?.enabled && options?.provider) {
    const CoverageProvider = CoverageProviderMap[options.provider]
    return new CoverageProvider()
  }
  return undefined
}

export function getCoverageInsideWorker(options: CoverageOptions) {
  if (options.enabled && options.provider) {
    const CoverageProvider = CoverageProviderMap[options.provider]

    return CoverageProvider.getCoverage()
  }
}
