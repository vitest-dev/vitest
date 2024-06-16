import { relative } from 'pathe'
import mm from 'micromatch'
import type { CoverageMap } from 'istanbul-lib-coverage'
import type { BaseCoverageOptions, ResolvedCoverageOptions } from '../types'

type Threshold = 'lines' | 'functions' | 'statements' | 'branches'

interface ResolvedThreshold {
  coverageMap: CoverageMap
  name: string
  thresholds: Partial<Record<Threshold, number | undefined>>
}

const THRESHOLD_KEYS: Readonly<Threshold[]> = [
  'lines',
  'functions',
  'statements',
  'branches',
]
const GLOBAL_THRESHOLDS_KEY = 'global'

export class BaseCoverageProvider {
  /**
   * Check if current coverage is above configured thresholds and bump the thresholds if needed
   */
  updateThresholds({
    thresholds: allThresholds,
    perFile,
    configurationFile,
    onUpdate,
  }: {
    thresholds: ResolvedThreshold[]
    perFile?: boolean
    configurationFile: unknown // ProxifiedModule from magicast
    onUpdate: () => void
  }) {
    let updatedThresholds = false

    const config = resolveConfig(configurationFile)
    assertConfigurationModule(config)

    for (const { coverageMap, thresholds, name } of allThresholds) {
      const summaries = perFile
        ? coverageMap
          .files()
          .map((file: string) =>
            coverageMap.fileCoverageFor(file).toSummary(),
          )
        : [coverageMap.getCoverageSummary()]

      const thresholdsToUpdate: [Threshold, number][] = []

      for (const key of THRESHOLD_KEYS) {
        const threshold = thresholds[key] ?? 100
        const actual = Math.min(
          ...summaries.map(summary => summary[key].pct),
        )

        if (actual > threshold) {
          thresholdsToUpdate.push([key, actual])
        }
      }

      if (thresholdsToUpdate.length === 0) {
        continue
      }

      updatedThresholds = true

      for (const [threshold, newValue] of thresholdsToUpdate) {
        if (name === GLOBAL_THRESHOLDS_KEY) {
          config.test.coverage.thresholds[threshold] = newValue
        }
        else {
          const glob = config.test.coverage.thresholds[
            name as Threshold
          ] as ResolvedThreshold['thresholds']
          glob[threshold] = newValue
        }
      }
    }

    if (updatedThresholds) {
      // eslint-disable-next-line no-console
      console.log(
        'Updating thresholds to configuration file. You may want to push with updated coverage thresholds.',
      )
      onUpdate()
    }
  }

  /**
   * Check collected coverage against configured thresholds. Sets exit code to 1 when thresholds not reached.
   */
  checkThresholds({
    thresholds: allThresholds,
    perFile,
  }: {
    thresholds: ResolvedThreshold[]
    perFile?: boolean
  }) {
    for (const { coverageMap, thresholds, name } of allThresholds) {
      if (
        thresholds.branches === undefined
        && thresholds.functions === undefined
        && thresholds.lines === undefined
        && thresholds.statements === undefined
      ) {
        continue
      }

      // Construct list of coverage summaries where thresholds are compared against
      const summaries = perFile
        ? coverageMap.files().map((file: string) => ({
          file,
          summary: coverageMap.fileCoverageFor(file).toSummary(),
        }))
        : [
            {
              file: null,
              summary: coverageMap.getCoverageSummary(),
            },
          ]

      // Check thresholds of each summary
      for (const { summary, file } of summaries) {
        for (const thresholdKey of [
          'lines',
          'functions',
          'statements',
          'branches',
        ] as const) {
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
              let errorMessage = `ERROR: Coverage for ${thresholdKey} (${coverage}%) does not meet ${
                name === GLOBAL_THRESHOLDS_KEY ? name : `"${name}"`
              } threshold (${threshold}%)`

              if (perFile && file) {
                errorMessage += ` for ${relative('./', file).replace(
                  /\\/g,
                  '/',
                )}`
              }

              console.error(errorMessage)
            }
          }
        }
      }
    }
  }

  /**
   * Constructs collected coverage and users' threshold options into separate sets
   * where each threshold set holds their own coverage maps. Threshold set is either
   * for specific files defined by glob pattern or global for all other files.
   */
  resolveThresholds({
    coverageMap,
    thresholds,
    createCoverageMap,
    root,
  }: {
    coverageMap: CoverageMap
    thresholds: NonNullable<BaseCoverageOptions['thresholds']>
    createCoverageMap: () => CoverageMap
    root: string
  }): ResolvedThreshold[] {
    const resolvedThresholds: ResolvedThreshold[] = []
    const files = coverageMap.files()
    const filesMatchedByGlobs: string[] = []
    const globalCoverageMap = createCoverageMap()

    for (const key of Object.keys(
      thresholds,
    ) as `${keyof typeof thresholds}`[]) {
      if (
        key === 'perFile'
        || key === 'autoUpdate'
        || key === '100'
        || THRESHOLD_KEYS.includes(key)
      ) {
        continue
      }

      const glob = key
      const globThresholds = resolveGlobThresholds(thresholds[glob])
      const globCoverageMap = createCoverageMap()

      const matchingFiles = files.filter(file =>
        mm.isMatch(relative(root, file), glob),
      )
      filesMatchedByGlobs.push(...matchingFiles)

      for (const file of matchingFiles) {
        const fileCoverage = coverageMap.fileCoverageFor(file)
        globCoverageMap.addFileCoverage(fileCoverage)
      }

      resolvedThresholds.push({
        name: glob,
        coverageMap: globCoverageMap,
        thresholds: globThresholds,
      })
    }

    // Global threshold is for all files that were not included by glob patterns
    for (const file of files.filter(
      file => !filesMatchedByGlobs.includes(file),
    )) {
      const fileCoverage = coverageMap.fileCoverageFor(file)
      globalCoverageMap.addFileCoverage(fileCoverage)
    }

    resolvedThresholds.unshift({
      name: GLOBAL_THRESHOLDS_KEY,
      coverageMap: globalCoverageMap,
      thresholds: {
        branches: thresholds.branches,
        functions: thresholds.functions,
        lines: thresholds.lines,
        statements: thresholds.statements,
      },
    })

    return resolvedThresholds
  }

  /**
   * Resolve reporters from various configuration options
   */
  resolveReporters(
    configReporters: NonNullable<BaseCoverageOptions['reporter']>,
  ): ResolvedCoverageOptions['reporter'] {
    // E.g. { reporter: "html" }
    if (!Array.isArray(configReporters)) {
      return [[configReporters, {}]]
    }

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

  hasTerminalReporter(reporters: ResolvedCoverageOptions['reporter']) {
    return reporters.some(
      ([reporter]) =>
        reporter === 'text'
        || reporter === 'text-summary'
        || reporter === 'text-lcov'
        || reporter === 'teamcity',
    )
  }

  toSlices<T>(array: T[], size: number): T[][] {
    return array.reduce<T[][]>((chunks, item) => {
      const index = Math.max(0, chunks.length - 1)
      const lastChunk = chunks[index] || []
      chunks[index] = lastChunk

      if (lastChunk.length >= size) {
        chunks.push([item])
      }
      else {
        lastChunk.push(item)
      }

      return chunks
    }, [])
  }
}

/**
 * Narrow down `unknown` glob thresholds to resolved ones
 */
function resolveGlobThresholds(
  thresholds: unknown,
): ResolvedThreshold['thresholds'] {
  if (!thresholds || typeof thresholds !== 'object') {
    return {}
  }

  return {
    lines:
      'lines' in thresholds && typeof thresholds.lines === 'number'
        ? thresholds.lines
        : undefined,
    branches:
      'branches' in thresholds && typeof thresholds.branches === 'number'
        ? thresholds.branches
        : undefined,
    functions:
      'functions' in thresholds && typeof thresholds.functions === 'number'
        ? thresholds.functions
        : undefined,
    statements:
      'statements' in thresholds && typeof thresholds.statements === 'number'
        ? thresholds.statements
        : undefined,
  }
}

function assertConfigurationModule(config: unknown): asserts config is {
  test: {
    coverage: { thresholds: NonNullable<BaseCoverageOptions['thresholds']> }
  }
} {
  try {
    // @ts-expect-error -- Intentional unsafe null pointer check as wrapped in try-catch
    if (typeof config.test.coverage.thresholds !== 'object') {
      throw new TypeError(
        'Expected config.test.coverage.thresholds to be an object',
      )
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Unable to parse thresholds from configuration file: ${message}`,
    )
  }
}

function resolveConfig(configModule: any) {
  const mod = configModule.exports.default

  try {
    // Check for "export default { test: {...} }"
    if (mod.$type === 'object') {
      return mod
    }

    // "export default defineConfig(...)"
    let config = resolveDefineConfig(mod)
    if (config) {
      return config
    }

    // "export default mergeConfig(..., defineConfig(...))"
    if (mod.$type === 'function-call' && mod.$callee === 'mergeConfig') {
      config = resolveMergeConfig(mod)
      if (config) {
        return config
      }
    }
  }
  catch (error) {
    // Reduce magicast's verbose errors to readable ones
    throw new Error(error instanceof Error ? error.message : String(error))
  }

  throw new Error(
    'Failed to update coverage thresholds. Configuration file is too complex.',
  )
}

function resolveDefineConfig(mod: any) {
  if (mod.$type === 'function-call' && mod.$callee === 'defineConfig') {
    // "export default defineConfig({ test: {...} })"
    if (mod.$args[0].$type === 'object') {
      return mod.$args[0]
    }

    if (mod.$args[0].$type === 'arrow-function-expression') {
      if (mod.$args[0].$body.$type === 'object') {
        // "export default defineConfig(() => ({ test: {...} }))"
        return mod.$args[0].$body
      }

      // "export default defineConfig(() => mergeConfig({...}, ...))"
      const config = resolveMergeConfig(mod.$args[0].$body)
      if (config) {
        return config
      }
    }
  }
}

function resolveMergeConfig(mod: any): any {
  if (mod.$type === 'function-call' && mod.$callee === 'mergeConfig') {
    for (const arg of mod.$args) {
      const config = resolveDefineConfig(arg)
      if (config) {
        return config
      }
    }
  }
}
