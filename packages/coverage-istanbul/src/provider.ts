import { existsSync, promises as fs, writeFileSync } from 'node:fs'
import { resolve } from 'pathe'
import type { AfterSuiteRunMeta, CoverageIstanbulOptions, CoverageProvider, ReportContext, ResolvedCoverageOptions, Vitest } from 'vitest'
import { coverageConfigDefaults, defaultExclude, defaultInclude } from 'vitest/config'
import { BaseCoverageProvider } from 'vitest/coverage'
import c from 'picocolors'
import { parseModule } from 'magicast'
import createDebug from 'debug'
import libReport from 'istanbul-lib-report'
import reports from 'istanbul-reports'
import type { CoverageMap } from 'istanbul-lib-coverage'
import libCoverage from 'istanbul-lib-coverage'
import libSourceMaps from 'istanbul-lib-source-maps'
import { type Instrumenter, createInstrumenter } from 'istanbul-lib-instrument'

// @ts-expect-error missing types
import _TestExclude from 'test-exclude'
import { COVERAGE_STORE_KEY } from './constants'

type Options = ResolvedCoverageOptions<'istanbul'>
type Filename = string
type CoverageFilesByTransformMode = Record<AfterSuiteRunMeta['transformMode'], Filename[]>
type ProjectName = NonNullable<AfterSuiteRunMeta['projectName']> | typeof DEFAULT_PROJECT

interface TestExclude {
  new(opts: {
    cwd?: string | string[]
    include?: string | string[]
    exclude?: string | string[]
    extension?: string | string[]
    excludeNodeModules?: boolean
    relativePath?: boolean
  }): {
    shouldInstrument(filePath: string): boolean
    glob(cwd: string): Promise<string[]>
  }
}

const DEFAULT_PROJECT = Symbol.for('default-project')
const debug = createDebug('vitest:coverage')
let uniqueId = 0

export class IstanbulCoverageProvider extends BaseCoverageProvider implements CoverageProvider {
  name = 'istanbul'

  ctx!: Vitest
  options!: Options
  instrumenter!: Instrumenter
  testExclude!: InstanceType<TestExclude>

  coverageFiles = new Map<ProjectName, CoverageFilesByTransformMode>()
  coverageFilesDirectory!: string
  pendingPromises: Promise<void>[] = []

  initialize(ctx: Vitest) {
    const config: CoverageIstanbulOptions = ctx.config.coverage

    this.ctx = ctx
    this.options = {
      ...coverageConfigDefaults,

      // User's options
      ...config,

      // Resolved fields
      provider: 'istanbul',
      reportsDirectory: resolve(ctx.config.root, config.reportsDirectory || coverageConfigDefaults.reportsDirectory),
      reporter: this.resolveReporters(config.reporter || coverageConfigDefaults.reporter),

      thresholds: config.thresholds && {
        ...config.thresholds,
        lines: config.thresholds['100'] ? 100 : config.thresholds.lines,
        branches: config.thresholds['100'] ? 100 : config.thresholds.branches,
        functions: config.thresholds['100'] ? 100 : config.thresholds.functions,
        statements: config.thresholds['100'] ? 100 : config.thresholds.statements,
      },
    }

    this.instrumenter = createInstrumenter({
      produceSourceMap: true,
      autoWrap: false,
      esModules: true,
      compact: false,
      coverageVariable: COVERAGE_STORE_KEY,
      // @ts-expect-error missing type
      coverageGlobalScope: 'globalThis',
      coverageGlobalScopeFunc: false,
      ignoreClassMethods: this.options.ignoreClassMethods,
    })

    this.testExclude = new _TestExclude({
      cwd: ctx.config.root,
      include: typeof this.options.include === 'undefined' ? undefined : [...this.options.include],
      exclude: [...defaultExclude, ...defaultInclude, ...this.options.exclude],
      excludeNodeModules: true,
      extension: this.options.extension,
      relativePath: !this.options.allowExternal,
    })

    this.coverageFilesDirectory = resolve(this.options.reportsDirectory, '.tmp')
  }

  resolveOptions() {
    return this.options
  }

  onFileTransform(sourceCode: string, id: string, pluginCtx: any) {
    if (!this.testExclude.shouldInstrument(id))
      return

    const sourceMap = pluginCtx.getCombinedSourcemap()
    sourceMap.sources = sourceMap.sources.map(removeQueryParameters)

    const code = this.instrumenter.instrumentSync(sourceCode, id, sourceMap as any)
    const map = this.instrumenter.lastSourceMap() as any

    return { code, map }
  }

  /*
   * Coverage and meta information passed from Vitest runners.
   * Note that adding new entries here and requiring on those without
   * backwards compatibility is a breaking change.
   */
  onAfterSuiteRun({ coverage, transformMode, projectName }: AfterSuiteRunMeta) {
    if (!coverage)
      return

    if (transformMode !== 'web' && transformMode !== 'ssr')
      throw new Error(`Invalid transform mode: ${transformMode}`)

    let entry = this.coverageFiles.get(projectName || DEFAULT_PROJECT)

    if (!entry) {
      entry = { web: [], ssr: [] }
      this.coverageFiles.set(projectName || DEFAULT_PROJECT, entry)
    }

    const filename = resolve(this.coverageFilesDirectory, `coverage-${uniqueId++}.json`)
    entry[transformMode].push(filename)

    const promise = fs.writeFile(filename, JSON.stringify(coverage), 'utf-8')
    this.pendingPromises.push(promise)
  }

  async clean(clean = true) {
    if (clean && existsSync(this.options.reportsDirectory))
      await fs.rm(this.options.reportsDirectory, { recursive: true, force: true, maxRetries: 10 })

    if (existsSync(this.coverageFilesDirectory))
      await fs.rm(this.coverageFilesDirectory, { recursive: true, force: true, maxRetries: 10 })

    await fs.mkdir(this.coverageFilesDirectory, { recursive: true })

    this.coverageFiles = new Map()
    this.pendingPromises = []
  }

  async reportCoverage({ allTestsRun }: ReportContext = {}) {
    const coverageMap = libCoverage.createCoverageMap({})
    let index = 0
    const total = this.pendingPromises.length

    await Promise.all(this.pendingPromises)
    this.pendingPromises = []

    for (const coveragePerProject of this.coverageFiles.values()) {
      for (const filenames of [coveragePerProject.ssr, coveragePerProject.web]) {
        const coverageMapByTransformMode = libCoverage.createCoverageMap({})

        for (const chunk of toSlices(filenames, this.options.processingConcurrency)) {
          if (debug.enabled) {
            index += chunk.length
            debug('Covered files %d/%d', index, total)
          }

          await Promise.all(chunk.map(async (filename) => {
            const contents = await fs.readFile(filename, 'utf-8')
            const coverage = JSON.parse(contents) as CoverageMap

            coverageMapByTransformMode.merge(coverage)
          }))
        }

        // Source maps can change based on projectName and transform mode.
        // Coverage transform re-uses source maps so we need to separate transforms from each other.
        const transformedCoverage = await transformCoverage(coverageMapByTransformMode)
        coverageMap.merge(transformedCoverage)
      }
    }

    if (this.options.all && allTestsRun) {
      const coveredFiles = coverageMap.files()
      const uncoveredCoverage = await this.getCoverageMapForUncoveredFiles(coveredFiles)

      coverageMap.merge(await transformCoverage(uncoveredCoverage))
    }

    const context = libReport.createContext({
      dir: this.options.reportsDirectory,
      coverageMap,
      watermarks: this.options.watermarks,
    })

    if (hasTerminalReporter(this.options.reporter))
      this.ctx.logger.log(c.blue(' % ') + c.dim('Coverage report from ') + c.yellow(this.name))

    for (const reporter of this.options.reporter) {
      reports.create(reporter[0], {
        skipFull: this.options.skipFull,
        projectRoot: this.ctx.config.root,
        ...reporter[1],
      }).execute(context)
    }

    if (this.options.thresholds) {
      const resolvedThresholds = this.resolveThresholds({
        coverageMap,
        thresholds: this.options.thresholds,
        createCoverageMap: () => libCoverage.createCoverageMap({}),
      })

      this.checkThresholds({
        thresholds: resolvedThresholds,
        perFile: this.options.thresholds.perFile,
      })

      if (this.options.thresholds.autoUpdate && allTestsRun) {
        if (!this.ctx.server.config.configFile)
          throw new Error('Missing configurationFile. The "coverage.thresholds.autoUpdate" can only be enabled when configuration file is used.')

        const configFilePath = this.ctx.server.config.configFile
        const configModule = parseModule(await fs.readFile(configFilePath, 'utf8'))

        this.updateThresholds({
          thresholds: resolvedThresholds,
          perFile: this.options.thresholds.perFile,
          configurationFile: {
            write: () => writeFileSync(configFilePath, configModule.generate().code, 'utf-8'),
            read: () => configModule.exports.default.$type === 'function-call'
              ? configModule.exports.default.$args[0]
              : configModule.exports.default,
          },
        })
      }
    }

    await fs.rm(this.coverageFilesDirectory, { recursive: true })
    this.coverageFiles = new Map()
  }

  async getCoverageMapForUncoveredFiles(coveredFiles: string[]) {
    // Load, instrument and collect empty coverages from all files which
    // are not already in the coverage map
    const includedFiles = await this.testExclude.glob(this.ctx.config.root)
    const uncoveredFiles = includedFiles
      .map(file => resolve(this.ctx.config.root, file))
      .filter(file => !coveredFiles.includes(file))

    const coverageMap = libCoverage.createCoverageMap({})

    // Note that these cannot be run parallel as synchronous instrumenter.lastFileCoverage
    // returns the coverage of the last transformed file
    for (const [index, filename] of uncoveredFiles.entries()) {
      debug('Uncovered file %s %d/%d', filename, index, uncoveredFiles.length)

      // Make sure file is not served from cache
      // so that instrumenter loads up requested file coverage
      if (this.ctx.vitenode.fetchCache.has(filename))
        this.ctx.vitenode.fetchCache.delete(filename)

      await this.ctx.vitenode.transformRequest(filename)

      const lastCoverage = this.instrumenter.lastFileCoverage()
      coverageMap.addFileCoverage(lastCoverage)
    }

    return coverageMap
  }
}

async function transformCoverage(coverageMap: CoverageMap) {
  includeImplicitElseBranches(coverageMap)

  const sourceMapStore = libSourceMaps.createSourceMapStore()
  return await sourceMapStore.transformCoverage(coverageMap)
}

/**
 * Remove possible query parameters from filenames
 * - From `/src/components/Header.component.ts?vue&type=script&src=true&lang.ts`
 * - To `/src/components/Header.component.ts`
 */
function removeQueryParameters(filename: string) {
  return filename.split('?')[0]
}

/**
 * Work-around for #1887 and #2239 while waiting for https://github.com/istanbuljs/istanbuljs/pull/706
 *
 * Goes through all files in the coverage map and checks if branchMap's have
 * if-statements with implicit else. When finds one, copies source location of
 * the if-statement into the else statement.
 */
function includeImplicitElseBranches(coverageMap: CoverageMap) {
  for (const file of coverageMap.files()) {
    const fileCoverage = coverageMap.fileCoverageFor(file)

    for (const branchMap of Object.values(fileCoverage.branchMap)) {
      if (branchMap.type === 'if') {
        const lastIndex = branchMap.locations.length - 1

        if (lastIndex > 0) {
          const elseLocation = branchMap.locations[lastIndex]

          if (elseLocation && isEmptyCoverageRange(elseLocation)) {
            const ifLocation = branchMap.locations[0]

            elseLocation.start = { ...ifLocation.start }
            elseLocation.end = { ...ifLocation.end }
          }
        }
      }
    }
  }
}

function isEmptyCoverageRange(range: libCoverage.Range) {
  return (
    range.start === undefined
    || range.start.line === undefined
    || range.start.column === undefined
    || range.end === undefined
    || range.end.line === undefined
    || range.end.column === undefined
  )
}

function hasTerminalReporter(reporters: Options['reporter']) {
  return reporters.some(([reporter]) =>
    reporter === 'text'
    || reporter === 'text-summary'
    || reporter === 'text-lcov'
    || reporter === 'teamcity')
}

function toSlices<T>(array: T[], size: number): T[][] {
  return array.reduce<T[][]>((chunks, item) => {
    const index = Math.max(0, chunks.length - 1)
    const lastChunk = chunks[index] || []
    chunks[index] = lastChunk

    if (lastChunk.length >= size)
      chunks.push([item])

    else
      lastChunk.push(item)

    return chunks
  }, [])
}
