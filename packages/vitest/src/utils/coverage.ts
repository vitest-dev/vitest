import { readFileSync, writeFileSync } from 'node:fs'
import { relative } from 'pathe'
import type { CoverageMap } from 'istanbul-lib-coverage'
import type { BaseCoverageOptions, ResolvedCoverageOptions } from '../types'

type Threshold = 'lines' | 'functions' | 'statements' | 'branches'

const THRESHOLD_KEYS: Readonly<Threshold[]> = ['lines', 'functions', 'statements', 'branches']

export class BaseCoverageProvider {
  /**
   * Check if current coverage is above configured thresholds and bump the thresholds if needed
   */
  updateThresholds({ configurationFile, coverageMap, thresholds, perFile }: {
    coverageMap: CoverageMap
    thresholds: Record<Threshold, number | undefined>
    perFile?: boolean
    configurationFile?: string
  }) {
    // Thresholds cannot be updated if there is no configuration file and
    // feature was enabled by CLI, e.g. --coverage.thresholdAutoUpdate
    if (!configurationFile)
      throw new Error('Missing configurationFile. The "coverage.thresholdAutoUpdate" can only be enabled when configuration file is used.')

    const summaries = perFile
      ? coverageMap.files()
        .map((file: string) => coverageMap.fileCoverageFor(file).toSummary())
      : [coverageMap.getCoverageSummary()]

    const thresholdsToUpdate: [Threshold, number][] = []

    for (const key of THRESHOLD_KEYS) {
      const threshold = thresholds[key] ?? 100
      const actual = Math.min(...summaries.map(summary => summary[key].pct))

      if (actual > threshold)
        thresholdsToUpdate.push([key, actual])
    }

    if (thresholdsToUpdate.length === 0)
      return

    const originalConfig = readFileSync(configurationFile, 'utf8')
    let updatedConfig = originalConfig

    for (const [threshold, newValue] of thresholdsToUpdate) {
      // Find the exact match from the configuration file and replace the value
      const previousThreshold = (thresholds[threshold] ?? 100).toString()
      const pattern = new RegExp(`(${threshold}\\s*:\\s*)${previousThreshold.replace('.', '\\.')}`)
      const matches = originalConfig.match(pattern)

      if (matches)
        updatedConfig = updatedConfig.replace(matches[0], matches[1] + newValue)
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
   * Checked collected coverage against configured thresholds. Sets exit code to 1 when thresholds not reached.
   */
  checkThresholds({ coverageMap, thresholds, perFile }: {
    coverageMap: CoverageMap
    thresholds: Record<Threshold, number | undefined>
    perFile?: boolean
  }) {
    // Construct list of coverage summaries where thresholds are compared against
    const summaries = perFile
      ? coverageMap.files()
        .map((file: string) => ({
          file,
          summary: coverageMap.fileCoverageFor(file).toSummary(),
        }))
      : [{
          file: null,
          summary: coverageMap.getCoverageSummary(),
        }]

    // Check thresholds of each summary
    for (const { summary, file } of summaries) {
      for (const thresholdKey of ['lines', 'functions', 'statements', 'branches'] as const) {
        const threshold = thresholds[thresholdKey]

        if (threshold !== undefined) {
          const coverage = summary.data[thresholdKey].pct

          if (coverage < threshold) {
            process.exitCode = 1

            /*
             * Generate error message based on perFile flag:
             * - ERROR: Coverage for statements (33.33%) does not meet threshold (85%) for src/math.ts
             * - ERROR: Coverage for statements (50%) does not meet global threshold (85%)
             */
            let errorMessage = `ERROR: Coverage for ${thresholdKey} (${coverage}%) does not meet`

            if (!perFile)
              errorMessage += ' global'

            errorMessage += ` threshold (${threshold}%)`

            if (perFile && file)
              errorMessage += ` for ${relative('./', file).replace(/\\/g, '/')}`

            console.error(errorMessage)
          }
        }
      }
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
