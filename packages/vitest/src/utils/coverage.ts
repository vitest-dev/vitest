import type { CoverageMap } from 'istanbul-lib-coverage'
import type { Vitest } from '../node/core'
import type { BaseCoverageOptions, ReportContext, ResolvedCoverageOptions } from '../node/types/coverage'
import type { AfterSuiteRunMeta } from '../types/general'
import { existsSync, promises as fs, readdirSync, writeFileSync } from 'node:fs'
import mm from 'micromatch'
import { relative, resolve } from 'pathe'
import c from 'tinyrainbow'
import { coverageConfigDefaults } from '../defaults'
import { resolveCoverageReporters } from '../node/config/resolveConfig'

type Threshold = 'lines' | 'functions' | 'statements' | 'branches'

interface ResolvedThreshold {
  coverageMap: CoverageMap
  name: string
  thresholds: Partial<Record<Threshold, number | undefined>>
}

/**
 * Holds info about raw coverage results that are stored on file system:
 *
 * ```json
 * "project-a": {
 *   "web": {
 *     "tests/math.test.ts": "coverage-1.json",
 *     "tests/utils.test.ts": "coverage-2.json",
 * //                          ^^^^^^^^^^^^^^^ Raw coverage on file system
 *   },
 *   "ssr": { ... },
 *   "browser": { ... },
 * },
 * "project-b": ...
 * ```
 */
type CoverageFiles = Map<
  NonNullable<AfterSuiteRunMeta['projectName']> | symbol,
  Record<
    AfterSuiteRunMeta['transformMode'],
    { [TestFilenames: string]: string }
  >
>
type Entries<T> = [keyof T, T[keyof T]][]

const THRESHOLD_KEYS: Readonly<Threshold[]> = [
  'lines',
  'functions',
  'statements',
  'branches',
]
const GLOBAL_THRESHOLDS_KEY = 'global'
const DEFAULT_PROJECT: unique symbol = Symbol.for('default-project')
let uniqueId = 0

export class BaseCoverageProvider<Options extends ResolvedCoverageOptions<'istanbul' | 'v8'>> {
  ctx!: Vitest
  readonly name!: 'v8' | 'istanbul'
  version!: string
  options!: Options

  coverageFiles: CoverageFiles = new Map()
  pendingPromises: Promise<void>[] = []
  coverageFilesDirectory!: string

  _initialize(ctx: Vitest) {
    this.ctx = ctx

    if (ctx.version !== this.version) {
      ctx.logger.warn(
        c.yellow(
          `Loaded ${c.inverse(c.yellow(` vitest@${ctx.version} `))} and ${c.inverse(c.yellow(` @vitest/coverage-${this.name}@${this.version} `))}.`
          + '\nRunning mixed versions is not supported and may lead into bugs'
          + '\nUpdate your dependencies and make sure the versions match.',
        ),
      )
    }

    const config = ctx.config.coverage as Options

    this.options = {
      ...coverageConfigDefaults,

      // User's options
      ...config,

      // Resolved fields
      provider: this.name,
      reportsDirectory: resolve(
        ctx.config.root,
        config.reportsDirectory || coverageConfigDefaults.reportsDirectory,
      ),
      reporter: resolveCoverageReporters(
        config.reporter || coverageConfigDefaults.reporter,
      ),
      thresholds: config.thresholds && {
        ...config.thresholds,
        lines: config.thresholds['100'] ? 100 : config.thresholds.lines,
        branches: config.thresholds['100'] ? 100 : config.thresholds.branches,
        functions: config.thresholds['100'] ? 100 : config.thresholds.functions,
        statements: config.thresholds['100'] ? 100 : config.thresholds.statements,
      },
    }

    const shard = this.ctx.config.shard
    const tempDirectory = `.tmp${
      shard ? `-${shard.index}-${shard.count}` : ''
    }`

    this.coverageFilesDirectory = resolve(
      this.options.reportsDirectory,
      tempDirectory,
    )
  }

  createCoverageMap(): CoverageMap {
    throw new Error('BaseReporter\'s createCoverageMap was not overwritten')
  }

  async generateReports(_: CoverageMap, __: boolean | undefined) {
    throw new Error('BaseReporter\'s generateReports was not overwritten')
  }

  async parseConfigModule(_: string): Promise<{ generate: () => { code: string } }> {
    throw new Error('BaseReporter\'s parseConfigModule was not overwritten')
  }

  resolveOptions() {
    return this.options
  }

  async clean(clean = true): Promise<void> {
    if (clean && existsSync(this.options.reportsDirectory)) {
      await fs.rm(this.options.reportsDirectory, {
        recursive: true,
        force: true,
        maxRetries: 10,
      })
    }

    if (existsSync(this.coverageFilesDirectory)) {
      await fs.rm(this.coverageFilesDirectory, {
        recursive: true,
        force: true,
        maxRetries: 10,
      })
    }

    await fs.mkdir(this.coverageFilesDirectory, { recursive: true })

    this.coverageFiles = new Map()
    this.pendingPromises = []
  }

  onAfterSuiteRun({ coverage, transformMode, projectName, testFiles }: AfterSuiteRunMeta): void {
    if (!coverage) {
      return
    }

    if (transformMode !== 'web' && transformMode !== 'ssr' && transformMode !== 'browser') {
      throw new Error(`Invalid transform mode: ${transformMode}`)
    }

    let entry = this.coverageFiles.get(projectName || DEFAULT_PROJECT)

    if (!entry) {
      entry = { web: {}, ssr: {}, browser: {} }
      this.coverageFiles.set(projectName || DEFAULT_PROJECT, entry)
    }

    const testFilenames = testFiles.join()
    const filename = resolve(
      this.coverageFilesDirectory,
      `coverage-${uniqueId++}.json`,
    )

    // If there's a result from previous run, overwrite it
    entry[transformMode][testFilenames] = filename

    const promise = fs.writeFile(filename, JSON.stringify(coverage), 'utf-8')
    this.pendingPromises.push(promise)
  }

  async readCoverageFiles<CoverageType>({ onFileRead, onFinished, onDebug }: {
    /** Callback invoked with a single coverage result */
    onFileRead: (data: CoverageType) => void
    /** Callback invoked once all results of a project for specific transform mode are read */
    onFinished: (project: Vitest['projects'][number], transformMode: AfterSuiteRunMeta['transformMode']) => Promise<void>
    onDebug: ((...logs: any[]) => void) & { enabled: boolean }
  }) {
    let index = 0
    const total = this.pendingPromises.length

    await Promise.all(this.pendingPromises)
    this.pendingPromises = []

    for (const [projectName, coveragePerProject] of this.coverageFiles.entries()) {
      for (const [transformMode, coverageByTestfiles] of Object.entries(coveragePerProject) as Entries<typeof coveragePerProject>) {
        const filenames = Object.values(coverageByTestfiles)
        const project = this.ctx.getProjectByName(projectName as string)

        for (const chunk of this.toSlices(filenames, this.options.processingConcurrency)) {
          if (onDebug.enabled) {
            index += chunk.length
            onDebug('Covered files %d/%d', index, total)
          }

          await Promise.all(chunk.map(async (filename) => {
            const contents = await fs.readFile(filename, 'utf-8')
            const coverage = JSON.parse(contents)

            onFileRead(coverage)
          }),
          )
        }

        await onFinished(project, transformMode)
      }
    }
  }

  async cleanAfterRun() {
    this.coverageFiles = new Map()
    await fs.rm(this.coverageFilesDirectory, { recursive: true })

    // Remove empty reports directory, e.g. when only text-reporter is used
    if (readdirSync(this.options.reportsDirectory).length === 0) {
      await fs.rm(this.options.reportsDirectory, { recursive: true })
    }
  }

  async onTestFailure() {
    if (!this.options.reportOnFailure) {
      await this.cleanAfterRun()
    }
  }

  async reportCoverage(coverageMap: unknown, { allTestsRun }: ReportContext): Promise<void> {
    await this.generateReports(
      (coverageMap as CoverageMap) || this.createCoverageMap(),
      allTestsRun,
    )

    // In watch mode we need to preserve the previous results if cleanOnRerun is disabled
    const keepResults = !this.options.cleanOnRerun && this.ctx.config.watch

    if (!keepResults) {
      await this.cleanAfterRun()
    }
  }

  async reportThresholds(coverageMap: CoverageMap, allTestsRun: boolean | undefined) {
    const resolvedThresholds = this.resolveThresholds(coverageMap)
    this.checkThresholds(resolvedThresholds)

    if (this.options.thresholds?.autoUpdate && allTestsRun) {
      if (!this.ctx.server.config.configFile) {
        throw new Error(
          'Missing configurationFile. The "coverage.thresholds.autoUpdate" can only be enabled when configuration file is used.',
        )
      }

      const configFilePath = this.ctx.server.config.configFile
      const configModule = await this.parseConfigModule(configFilePath)

      await this.updateThresholds({
        thresholds: resolvedThresholds,
        configurationFile: configModule,
        onUpdate: () =>
          writeFileSync(
            configFilePath,
            configModule.generate().code,
            'utf-8',
          ),

      })
    }
  }

  /**
   * Constructs collected coverage and users' threshold options into separate sets
   * where each threshold set holds their own coverage maps. Threshold set is either
   * for specific files defined by glob pattern or global for all other files.
   */
  private resolveThresholds(coverageMap: CoverageMap): ResolvedThreshold[] {
    const resolvedThresholds: ResolvedThreshold[] = []
    const files = coverageMap.files()
    const globalCoverageMap = this.createCoverageMap()

    for (const key of Object.keys(this.options.thresholds!) as `${keyof NonNullable<typeof this.options.thresholds>}`[]) {
      if (
        key === 'perFile'
        || key === 'autoUpdate'
        || key === '100'
        || THRESHOLD_KEYS.includes(key)
      ) {
        continue
      }

      const glob = key
      const globThresholds = resolveGlobThresholds(this.options.thresholds![glob])
      const globCoverageMap = this.createCoverageMap()

      const matchingFiles = files.filter(file =>
        mm.isMatch(relative(this.ctx.config.root, file), glob),
      )

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

    // Global threshold is for all files, even if they are included by glob patterns
    for (const file of files) {
      const fileCoverage = coverageMap.fileCoverageFor(file)
      globalCoverageMap.addFileCoverage(fileCoverage)
    }

    resolvedThresholds.unshift({
      name: GLOBAL_THRESHOLDS_KEY,
      coverageMap: globalCoverageMap,
      thresholds: {
        branches: this.options.thresholds?.branches,
        functions: this.options.thresholds?.functions,
        lines: this.options.thresholds?.lines,
        statements: this.options.thresholds?.statements,
      },
    })

    return resolvedThresholds
  }

  /**
   * Check collected coverage against configured thresholds. Sets exit code to 1 when thresholds not reached.
   */
  private checkThresholds(allThresholds: ResolvedThreshold[]) {
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
      const summaries = this.options.thresholds?.perFile
        ? coverageMap.files().map((file: string) => ({
            file,
            summary: coverageMap.fileCoverageFor(file).toSummary(),
          }))
        : [{ file: null, summary: coverageMap.getCoverageSummary() }]

      // Check thresholds of each summary
      for (const { summary, file } of summaries) {
        for (const thresholdKey of THRESHOLD_KEYS) {
          const threshold = thresholds[thresholdKey]

          if (threshold === undefined) {
            continue
          }

          /**
           * Positive thresholds are treated as minimum coverage percentages (X means: X% of lines must be covered),
           * while negative thresholds are treated as maximum uncovered counts (-X means: X lines may be uncovered).
           */
          if (threshold >= 0) {
            const coverage = summary.data[thresholdKey].pct

            if (coverage < threshold) {
              process.exitCode = 1

              /**
               * Generate error message based on perFile flag:
               * - ERROR: Coverage for statements (33.33%) does not meet threshold (85%) for src/math.ts
               * - ERROR: Coverage for statements (50%) does not meet global threshold (85%)
               */
              let errorMessage = `ERROR: Coverage for ${thresholdKey} (${coverage}%) does not meet ${name === GLOBAL_THRESHOLDS_KEY ? name : `"${name}"`
              } threshold (${threshold}%)`

              if (this.options.thresholds?.perFile && file) {
                errorMessage += ` for ${relative('./', file).replace(/\\/g, '/')}`
              }

              this.ctx.logger.error(errorMessage)
            }
          }
          else {
            const uncovered = summary.data[thresholdKey].total - summary.data[thresholdKey].covered
            const absoluteThreshold = threshold * -1

            if (uncovered > absoluteThreshold) {
              process.exitCode = 1

              /**
               * Generate error message based on perFile flag:
               * - ERROR: Uncovered statements (33) exceed threshold (30) for src/math.ts
               * - ERROR: Uncovered statements (33) exceed global threshold (30)
               */
              let errorMessage = `ERROR: Uncovered ${thresholdKey} (${uncovered}) exceed ${name === GLOBAL_THRESHOLDS_KEY ? name : `"${name}"`
              } threshold (${absoluteThreshold})`

              if (this.options.thresholds?.perFile && file) {
                errorMessage += ` for ${relative('./', file).replace(/\\/g, '/')}`
              }

              this.ctx.logger.error(errorMessage)
            }
          }
        }
      }
    }
  }

  /**
   * Check if current coverage is above configured thresholds and bump the thresholds if needed
   */
  async updateThresholds({ thresholds: allThresholds, onUpdate, configurationFile }: {
    thresholds: ResolvedThreshold[]
    configurationFile: unknown // ProxifiedModule from magicast
    onUpdate: () => void
  }) {
    let updatedThresholds = false

    const config = resolveConfig(configurationFile)
    assertConfigurationModule(config)

    for (const { coverageMap, thresholds, name } of allThresholds) {
      const summaries = this.options.thresholds?.perFile
        ? coverageMap
            .files()
            .map((file: string) =>
              coverageMap.fileCoverageFor(file).toSummary(),
            )
        : [coverageMap.getCoverageSummary()]

      const thresholdsToUpdate: [Threshold, number][] = []

      for (const key of THRESHOLD_KEYS) {
        const threshold = thresholds[key] ?? 100
        /**
         * Positive thresholds are treated as minimum coverage percentages (X means: X% of lines must be covered),
         * while negative thresholds are treated as maximum uncovered counts (-X means: X lines may be uncovered).
         */
        if (threshold >= 0) {
          const actual = Math.min(
            ...summaries.map(summary => summary[key].pct),
          )

          if (actual > threshold) {
            thresholdsToUpdate.push([key, actual])
          }
        }
        else {
          const absoluteThreshold = threshold * -1
          const actual = Math.max(
            ...summaries.map(summary => summary[key].total - summary[key].covered),
          )

          if (actual < absoluteThreshold) {
            // If everything was covered, set new threshold to 100% (since a threshold of 0 would be considered as 0%)
            const updatedThreshold = actual === 0 ? 100 : actual * -1
            thresholdsToUpdate.push([key, updatedThreshold])
          }
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
          const glob = config.test.coverage.thresholds[name as Threshold] as ResolvedThreshold['thresholds']
          glob[threshold] = newValue
        }
      }
    }

    if (updatedThresholds) {
      this.ctx.logger.log('Updating thresholds to configuration file. You may want to push with updated coverage thresholds.')
      onUpdate()
    }
  }

  async mergeReports(coverageMaps: unknown[]): Promise<void> {
    const coverageMap = this.createCoverageMap()

    for (const coverage of coverageMaps) {
      coverageMap.merge(coverage as CoverageMap)
    }

    await this.generateReports(coverageMap, true)
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

  createUncoveredFileTransformer(ctx: Vitest) {
    const servers = [
      ...ctx.projects.map(project => ({
        root: project.config.root,
        vitenode: project.vitenode,
      })),
      // Check core last as it will match all files anyway
      { root: ctx.config.root, vitenode: ctx.vitenode },
    ]

    return async function transformFile(filename: string) {
      let lastError

      for (const { root, vitenode } of servers) {
        if (!filename.startsWith(root)) {
          continue
        }

        try {
          return await vitenode.transformRequest(filename)
        }
        catch (error) {
          lastError = error
        }
      }

      // All vite-node servers failed to transform the file
      throw lastError
    }
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

  if (100 in thresholds && thresholds[100] === true) {
    return {
      lines: 100,
      branches: 100,
      functions: 100,
      statements: 100,
    }
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
