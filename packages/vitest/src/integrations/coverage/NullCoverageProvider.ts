import type { ResolvedCoverageOptions } from '../../types'
import type { BaseCoverageProvider } from './base'

export class NullCoverageProvider implements BaseCoverageProvider {
  resolveOptions(): ResolvedCoverageOptions {
    return {
      provider: null,
      enabled: false,
      clean: false,
      cleanOnRerun: false,
      reportsDirectory: 'coverage',
      tempDirectory: 'coverage/tmp',
    }
  }

  initialize() {}
  clean() {}
  onAfterAllFilesRun() {}
  onAfterSuiteRun() {}
}
