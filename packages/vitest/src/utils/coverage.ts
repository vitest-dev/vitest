import type { BaseCoverageOptions, ResolvedCoverageOptions } from '../types'

export class BaseCoverageProvider {
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
