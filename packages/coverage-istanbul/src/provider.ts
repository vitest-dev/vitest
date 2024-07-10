import {
  existsSync,
  promises as fs,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'pathe'
import type {
  AfterSuiteRunMeta,
  CoverageIstanbulOptions,
  CoverageProvider,
  ReportContext,
  ResolvedCoverageOptions,
  Vitest,
} from 'vitest'
import {
  coverageConfigDefaults,
} from 'vitest/config'
import { BaseCoverageProvider } from 'vitest/coverage'
import c from 'tinyrainbow'
import { parseModule } from 'magicast'
import createDebug from 'debug'
import libReport from 'istanbul-lib-report'
import reports from 'istanbul-reports'
import type { CoverageMap } from 'istanbul-lib-coverage'
import libCoverage from 'istanbul-lib-coverage'
import libSourceMaps from 'istanbul-lib-source-maps'
import { type Instrumenter, createInstrumenter } from 'istanbul-lib-instrument'
// @ts-expect-error @istanbuljs/schema has no type definitions
import { defaults as istanbulDefaults } from '@istanbuljs/schema'

// @ts-expect-error missing types
import _TestExclude from 'test-exclude'
import { COVERAGE_STORE_KEY } from './constants'

type Options = ResolvedCoverageOptions<'istanbul'>
type Filename = string
type CoverageFilesByTransformMode = Record<
  AfterSuiteRunMeta['transformMode'],
  Filename[]
>
type ProjectName =
  | NonNullable<AfterSuiteRunMeta['projectName']>
  | typeof DEFAULT_PROJECT

interface TestExclude {
  new (opts: {
    cwd?: string | string[]
    include?: string | string[]
    exclude?: string | string[]
    extension?: string | string[]
    excludeNodeModules?: boolean
    relativePath?: boolean
  }): {
    shouldInstrument: (filePath: string) => boolean
    glob: (cwd: string) => Promise<string[]>
  }
}

const DEFAULT_PROJECT = Symbol.for('default-project')
const debug = createDebug('vitest:coverage')
let uniqueId = 0

export class IstanbulCoverageProvider
  extends BaseCoverageProvider
  implements CoverageProvider {
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
      reportsDirectory: resolve(
        ctx.config.root,
        config.reportsDirectory || coverageConfigDefaults.reportsDirectory,
      ),
      reporter: this.resolveReporters(
        config.reporter || coverageConfigDefaults.reporter,
      ),

      thresholds: config.thresholds && {
        ...config.thresholds,
        lines: config.thresholds['100'] ? 100 : config.thresholds.lines,
        branches: config.thresholds['100'] ? 100 : config.thresholds.branches,
        functions: config.thresholds['100'] ? 100 : config.thresholds.functions,
        statements: config.thresholds['100']
          ? 100
          : config.thresholds.statements,
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
      parserPlugins: [
        ...istanbulDefaults.instrumenter.parserPlugins,
        ['importAttributes', { deprecatedAssertSyntax: true }],
      ],
      generatorOpts: {
        importAttributesKeyword: 'with',
      },
    })

    this.testExclude = new _TestExclude({
      cwd: ctx.config.root,
      include: this.options.include,
      exclude: this.options.exclude,
      excludeNodeModules: true,
      extension: this.options.extension,
      relativePath: !this.options.allowExternal,
    })

    const shard = this.ctx.config.shard
    const tempDirectory = `.tmp${
      shard ? `-${shard.index}-${shard.count}` : ''
    }`

    this.coverageFilesDirectory = resolve(
      this.options.reportsDirectory,
      tempDirectory,
    )
  }

  resolveOptions() {
    return this.options
  }

  onFileTransform(sourceCode: string, id: string, pluginCtx: any) {
    if (!this.testExclude.shouldInstrument(id)) {
      return
    }

    const sourceMap = pluginCtx.getCombinedSourcemap()
    sourceMap.sources = sourceMap.sources.map(removeQueryParameters)

    // Exclude SWC's decorators that are left in source maps
    sourceCode = sourceCode.replaceAll(
      '_ts_decorate',
      '/* istanbul ignore next */_ts_decorate',
    )

    const code = this.instrumenter.instrumentSync(
      sourceCode,
      id,
      sourceMap as any,
    )
    const map = this.instrumenter.lastSourceMap() as any

    return { code, map }
  }

  /*
   * Coverage and meta information passed from Vitest runners.
   * Note that adding new entries here and requiring on those without
   * backwards compatibility is a breaking change.
   */
  onAfterSuiteRun({ coverage, transformMode, projectName }: AfterSuiteRunMeta) {
    if (!coverage) {
      return
    }

    if (transformMode !== 'web' && transformMode !== 'ssr') {
      throw new Error(`Invalid transform mode: ${transformMode}`)
    }

    let entry = this.coverageFiles.get(projectName || DEFAULT_PROJECT)

    if (!entry) {
      entry = { web: [], ssr: [] }
      this.coverageFiles.set(projectName || DEFAULT_PROJECT, entry)
    }

    const filename = resolve(
      this.coverageFilesDirectory,
      `coverage-${uniqueId++}.json`,
    )
    entry[transformMode].push(filename)

    const promise = fs.writeFile(filename, JSON.stringify(coverage), 'utf-8')
    this.pendingPromises.push(promise)
  }

  async clean(clean = true) {
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

  async generateCoverage({ allTestsRun }: ReportContext) {
    const coverageMap = libCoverage.createCoverageMap({})
    let index = 0
    const total = this.pendingPromises.length

    await Promise.all(this.pendingPromises)
    this.pendingPromises = []

    for (const coveragePerProject of this.coverageFiles.values()) {
      for (const filenames of [
        coveragePerProject.ssr,
        coveragePerProject.web,
      ]) {
        const coverageMapByTransformMode = libCoverage.createCoverageMap({})

        for (const chunk of this.toSlices(
          filenames,
          this.options.processingConcurrency,
        )) {
          if (debug.enabled) {
            index += chunk.length
            debug('Covered files %d/%d', index, total)
          }

          await Promise.all(
            chunk.map(async (filename) => {
              const contents = await fs.readFile(filename, 'utf-8')
              const coverage = JSON.parse(contents) as CoverageMap

              coverageMapByTransformMode.merge(coverage)
            }),
          )
        }

        // Source maps can change based on projectName and transform mode.
        // Coverage transform re-uses source maps so we need to separate transforms from each other.
        const transformedCoverage = await transformCoverage(
          coverageMapByTransformMode,
        )
        coverageMap.merge(transformedCoverage)
      }
    }

    if (this.options.all && allTestsRun) {
      const coveredFiles = coverageMap.files()
      const uncoveredCoverage = await this.getCoverageMapForUncoveredFiles(
        coveredFiles,
      )

      coverageMap.merge(await transformCoverage(uncoveredCoverage))
    }

    return coverageMap
  }

  async reportCoverage(coverageMap: unknown, { allTestsRun }: ReportContext) {
    await this.generateReports(
      (coverageMap as CoverageMap) || libCoverage.createCoverageMap({}),
      allTestsRun,
    )

    // In watch mode we need to preserve the previous results if cleanOnRerun is disabled
    const keepResults = !this.options.cleanOnRerun && this.ctx.config.watch

    if (!keepResults) {
      this.coverageFiles = new Map()
      await fs.rm(this.coverageFilesDirectory, { recursive: true })

      // Remove empty reports directory, e.g. when only text-reporter is used
      if (readdirSync(this.options.reportsDirectory).length === 0) {
        await fs.rm(this.options.reportsDirectory, { recursive: true })
      }
    }
  }

  async generateReports(
    coverageMap: CoverageMap,
    allTestsRun: boolean | undefined,
  ) {
    const context = libReport.createContext({
      dir: this.options.reportsDirectory,
      coverageMap,
      watermarks: this.options.watermarks,
    })

    if (this.hasTerminalReporter(this.options.reporter)) {
      this.ctx.logger.log(
        c.blue(' % ') + c.dim('Coverage report from ') + c.yellow(this.name),
      )
    }

    for (const reporter of this.options.reporter) {
      // Type assertion required for custom reporters
      reports
        .create(reporter[0] as Parameters<typeof reports.create>[0], {
          skipFull: this.options.skipFull,
          projectRoot: this.ctx.config.root,
          ...reporter[1],
        })
        .execute(context)
    }

    if (this.options.thresholds) {
      const resolvedThresholds = this.resolveThresholds({
        coverageMap,
        thresholds: this.options.thresholds,
        createCoverageMap: () => libCoverage.createCoverageMap({}),
        root: this.ctx.config.root,
      })

      this.checkThresholds({
        thresholds: resolvedThresholds,
        perFile: this.options.thresholds.perFile,
        onError: error => this.ctx.logger.error(error),
      })

      if (this.options.thresholds.autoUpdate && allTestsRun) {
        if (!this.ctx.server.config.configFile) {
          throw new Error(
            'Missing configurationFile. The "coverage.thresholds.autoUpdate" can only be enabled when configuration file is used.',
          )
        }

        const configFilePath = this.ctx.server.config.configFile
        const configModule = parseModule(
          await fs.readFile(configFilePath, 'utf8'),
        )

        this.updateThresholds({
          thresholds: resolvedThresholds,
          perFile: this.options.thresholds.perFile,
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
  }

  async mergeReports(coverageMaps: unknown[]) {
    const coverageMap = libCoverage.createCoverageMap({})

    for (const coverage of coverageMaps) {
      coverageMap.merge(coverage as CoverageMap)
    }

    await this.generateReports(coverageMap, true)
  }

  private async getCoverageMapForUncoveredFiles(coveredFiles: string[]) {
    const allFiles = await this.testExclude.glob(this.ctx.config.root)
    let includedFiles = allFiles.map(file =>
      resolve(this.ctx.config.root, file),
    )

    if (this.ctx.config.changed) {
      includedFiles = (this.ctx.config.related || []).filter(file =>
        includedFiles.includes(file),
      )
    }

    const uncoveredFiles = includedFiles
      .filter(file => !coveredFiles.includes(file))
      .sort()

    const cacheKey = new Date().getTime()
    const coverageMap = libCoverage.createCoverageMap({})

    // Note that these cannot be run parallel as synchronous instrumenter.lastFileCoverage
    // returns the coverage of the last transformed file
    for (const [index, filename] of uncoveredFiles.entries()) {
      debug('Uncovered file %s %d/%d', filename, index, uncoveredFiles.length)

      // Make sure file is not served from cache so that instrumenter loads up requested file coverage
      await this.ctx.vitenode.transformRequest(`${filename}?v=${cacheKey}`)
      const lastCoverage = this.instrumenter.lastFileCoverage()
      coverageMap.addFileCoverage(lastCoverage)
    }

    return coverageMap
  }
}

async function transformCoverage(coverageMap: CoverageMap) {
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
