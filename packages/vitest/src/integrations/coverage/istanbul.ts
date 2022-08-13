import { existsSync, promises as fs } from 'fs'
import { createRequire } from 'module'
import { relative, resolve } from 'pathe'
import type { ExistingRawSourceMap, TransformPluginContext } from 'rollup'

import { configDefaults, defaultExclude, defaultInclude } from '../../defaults'
import type { Vitest } from '../../node'
import type { IstanbulOptions, ResolvedCoverageOptions } from '../../types'
import type { CoverageProvider } from './base'

const require = createRequire(import.meta.url)
const coverageVariable = '__VITEST_COVERAGE__'

interface Instrumenter {
  instrumentSync(
    code: string,
    filename: string,
    inputSourceMap: object
  ): string
  lastSourceMap(): ExistingRawSourceMap
}

type Threshold = 'lines' | 'functions' | 'statements' | 'branches'

interface CoverageSummary {
  data: { [key in Threshold]: { pct: number } }
}

interface CoverageMap {
  files: () => string[]
  fileCoverageFor: (file: string) => { toSummary: () => CoverageSummary }
  getCoverageSummary: () => CoverageSummary
}

interface TestExclude {
  new(opts: {
    cwd?: string | string[]
    include?: string | string[]
    exclude?: string | string[]
    extension?: string | string[]
    excludeNodeModules?: boolean
  }): { shouldInstrument(filePath: string): boolean }
}

export class IstanbulCoverageProvider implements CoverageProvider {
  name = 'istanbul'

  ctx!: Vitest
  options!: ResolvedCoverageOptions & { provider: 'istanbul' }
  instrumenter!: Instrumenter
  testExclude!: InstanceType<TestExclude>

  /**
   * Coverage objects collected from workers.
   * Some istanbul utilizers write these into file system instead of storing in memory.
   * If storing in memory causes issues, we can simply write these into fs in `onAfterSuiteRun`
   * and read them back when merging coverage objects in `onAfterAllFilesRun`.
   */
  coverages: any[] = []

  initialize(ctx: Vitest) {
    this.ctx = ctx
    this.options = resolveIstanbulOptions(ctx.config.coverage, ctx.config.root)

    const { createInstrumenter } = require('istanbul-lib-instrument')
    this.instrumenter = createInstrumenter({
      produceSourceMap: true,
      autoWrap: false,
      esModules: true,
      coverageVariable,
      coverageGlobalScope: 'globalThis',
      coverageGlobalScopeFunc: false,
      ignoreClassMethods: this.options.ignoreClassMethods,
    })

    const TestExclude = require('test-exclude')
    this.testExclude = new TestExclude({
      cwd: ctx.config.root,
      exclude: [...defaultExclude, ...defaultInclude, ...this.options.exclude],
      excludeNodeModules: true,

      // @ts-expect-error -- extension is not typed in configDefaults for some reason
      extension: configDefaults.coverage.extension,
    })
  }

  resolveOptions(): ResolvedCoverageOptions {
    return this.options
  }

  onFileTransform(sourceCode: string, id: string, pluginCtx: TransformPluginContext) {
    if (!this.testExclude.shouldInstrument(id))
      return

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- ignoreRestSiblings should be enabled
    const { sourcesContent, ...sourceMap } = pluginCtx.getCombinedSourcemap()
    const code = this.instrumenter.instrumentSync(sourceCode, id, sourceMap)
    const map = this.instrumenter.lastSourceMap()

    return { code, map }
  }

  onAfterSuiteRun(coverage: any) {
    this.coverages.push(coverage)
  }

  async clean(clean = true) {
    if (clean && existsSync(this.options.reportsDirectory))
      await fs.rm(this.options.reportsDirectory, { recursive: true, force: true })

    this.coverages = []
  }

  async reportCoverage() {
    const libReport = require('istanbul-lib-report')
    const reports = require('istanbul-reports')
    const libCoverage = require('istanbul-lib-coverage')
    const libSourceMaps = require('istanbul-lib-source-maps')

    const mergedCoverage = this.coverages.reduce((coverage, previousCoverageMap) => {
      const map = libCoverage.createCoverageMap(coverage)
      map.merge(previousCoverageMap)

      return map
    }, {})

    const sourceMapStore = libSourceMaps.createSourceMapStore()
    const coverageMap: CoverageMap = await sourceMapStore.transformCoverage(mergedCoverage)

    const context = libReport.createContext({
      dir: this.options.reportsDirectory,
      coverageMap,
      sourceFinder: sourceMapStore.sourceFinder,
      watermarks: this.options.watermarks,
    })

    for (const reporter of this.options.reporter) {
      reports.create(reporter, {
        skipFull: this.options.skipFull,
      }).execute(context)
    }

    if (this.options.branches
      || this.options.functions
      || this.options.lines
      || this.options.statements) {
      this.checkThresholds(coverageMap, {
        branches: this.options.branches,
        functions: this.options.functions,
        lines: this.options.lines,
        statements: this.options.statements,
      })
    }
  }

  checkThresholds(coverageMap: CoverageMap, thresholds: Record<Threshold, number | undefined>) {
    // Construct list of coverage summaries where thresholds are compared against
    const summaries = this.options.perFile
      ? coverageMap.files().map((file: string) => ({ file, summary: coverageMap.fileCoverageFor(file).toSummary() }))
      : [{ summary: coverageMap.getCoverageSummary(), file: null }]

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

            if (!this.options.perFile)
              errorMessage += ' global'

            errorMessage += ` threshold (${threshold}%)`

            if (this.options.perFile && file)
              errorMessage += ` for ${relative('./', file).replace(/\\/g, '/')}`

            console.error(errorMessage)
          }
        }
      }
    }
  }

  static getCoverage() {
    // @ts-expect-error -- untyped global
    return globalThis[coverageVariable]
  }
}

function resolveIstanbulOptions(options: IstanbulOptions, root: string) {
  const reportsDirectory = resolve(root, options.reportsDirectory || configDefaults.coverage.reportsDirectory!)

  const resolved = {
    ...configDefaults.coverage,
    ...options,

    provider: 'istanbul',
    reportsDirectory,
    tempDirectory: resolve(reportsDirectory, 'tmp'),
  }

  return resolved as ResolvedCoverageOptions & { provider: 'istanbul' }
}
