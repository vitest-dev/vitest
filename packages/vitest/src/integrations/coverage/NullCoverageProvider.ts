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
      reporter: [],
      exclude: [],
      skipFull: true,
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
      perFile: false,
    }
  }

  initialize() {}
  clean() {}
  onAfterAllFilesRun() {}
  onAfterSuiteRun() {}
}
