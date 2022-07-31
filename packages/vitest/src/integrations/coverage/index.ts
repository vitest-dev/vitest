import type { CoverageOptions } from '../../types'
import type { BaseCoverageProvider } from './base'
import { C8CoverageProvider } from './c8'
import { IstanbulCoverageProvider } from './istanbul'
import { NullCoverageProvider } from './NullCoverageProvider'

export function getCoverageProvider(options?: CoverageOptions): BaseCoverageProvider {
  if (options?.enabled && options?.provider === 'c8')
    return new C8CoverageProvider()

  if (options?.enabled && options?.provider === 'istanbul')
    return new IstanbulCoverageProvider()

  return new NullCoverageProvider()
}
