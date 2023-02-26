import { readFileSync, writeFileSync } from 'node:fs'
import type { CoverageMap } from 'istanbul-lib-coverage'
import type { BaseCoverageOptions, ResolvedCoverageOptions } from '../types'

type Threshold = 'lines' | 'functions' | 'statements' | 'branches'

const THRESHOLD_KEYS: Readonly<Threshold[]> = ['lines', 'functions', 'statements', 'branches']

export class BaseCoverageProvider {
  /**
   * Check if current coverage is above configured thresholds and bump the thresholds if needed
   */
  updateThresholds({ configurationFile, coverageMap, thresholds }: {
    coverageMap: CoverageMap
    thresholds: Record<Threshold, number | undefined>
    configurationFile?: string
  }) {
    // Thresholds cannot be updated if there is no configuration file and
    // feature was enabled by CLI, e.g. --coverage.thresholdAutoUpdate
    if (!configurationFile)
      throw new Error('Missing configurationFile. The "coverage.thresholdAutoUpdate" can only be enabled when configuration file is used.')

    const summary = coverageMap.getCoverageSummary()
    const thresholdsToUpdate: Threshold[] = []

    for (const key of THRESHOLD_KEYS) {
      const threshold = thresholds[key] || 100
      const actual = summary[key].pct

      if (actual > threshold)
        thresholdsToUpdate.push(key)
    }

    if (thresholdsToUpdate.length === 0)
      return

    const originalConfig = readFileSync(configurationFile, 'utf8')
    let updatedConfig = originalConfig

    for (const threshold of thresholdsToUpdate) {
      // Find the exact match from the configuration file and replace the value
      const previousThreshold = (thresholds[threshold] || 100).toString()
      const pattern = new RegExp(`(${threshold}\\s*:\\s*)${previousThreshold.replace('.', '\\.')}`)
      const matches = originalConfig.match(pattern)

      if (matches)
        updatedConfig = updatedConfig.replace(matches[0], matches[1] + summary[threshold].pct)
      else
        console.error(`Unable to update coverage threshold ${threshold}. No threshold found using pattern ${pattern}`)
    }

    if (updatedConfig !== originalConfig) {
      // eslint-disable-next-line no-console
      console.log('Updating thresholds to configuration file. You may want to push with updated coverage thresholds.')
      writeFileSync(configurationFile, updatedConfig, 'utf-8')
    }
  }

  /**
   * Resolve reporters from various configuration options
   */
  resolveReporters(configReporters: NonNullable<BaseCoverageOptions['reporter']>): ResolvedCoverageOptions['reporter'] {
    // E.g. { reporter: "html" }
    if (!Array.isArray(configReporters))
      return [[configReporters, {}]]

    const resolvedReporters: ResolvedCoverageOptions['reporter'] = []

    for (const reporter of configReporters) {
      if (Array.isArray(reporter)) {
        // E.g. { reporter: [ ["html", { skipEmpty: true }], ["lcov"], ["json", { file: "map.json" }] ]}
        resolvedReporters.push([reporter[0], reporter[1] || {}])
      }
      else {
        // E.g. { reporter: ["html", "json"]}
        resolvedReporters.push([reporter, {}])
      }
    }

    return resolvedReporters
  }
}
