import type { CoverageProviderModule } from 'vitest/node'
import assert from 'node:assert'
import { BaseCoverageProviderModule } from './base'
import { writeCoverageFile } from './commands'

const mod: CoverageProviderModule = {
  takeCoverage(options) {
    const coverage = BaseCoverageProviderModule.takeCoverage()

    if (!coverage) {
      return
    }

    const coverageFilesDirectory = options?.coverageFilesDirectory
    assert(coverageFilesDirectory, 'coverageFilesDirectory is required')

    return writeCoverageFile(coverageFilesDirectory, coverage)
  },

  startCoverage() {
    BaseCoverageProviderModule.startCoverage()
  },

  getProvider() {
    return BaseCoverageProviderModule.getProvider()
  },
}

export default mod
