import type { CoverageOptions } from '../../types'

import type { BaseCoverageProvider } from './base'
import { C8CoverageProvider } from './c8'

export function getCoverageProvider(options?: CoverageOptions): BaseCoverageProvider {
  if (options?.enabled && options?.provider === 'c8')
    return new C8CoverageProvider()

  // TODO: Return NullCoverageProvider
  return new C8CoverageProvider()
}
