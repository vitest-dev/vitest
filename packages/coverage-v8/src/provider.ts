import {
  existsSync,
  promises as fs,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import type { Profiler } from 'node:inspector'
import { fileURLToPath, pathToFileURL } from 'node:url'
import v8ToIstanbul from 'v8-to-istanbul'
import { mergeProcessCovs } from '@bcoe/v8-coverage'
import libReport from 'istanbul-lib-report'
import reports from 'istanbul-reports'
import type { CoverageMap } from 'istanbul-lib-coverage'
import libCoverage from 'istanbul-lib-coverage'
import libSourceMaps from 'istanbul-lib-source-maps'
import MagicString from 'magic-string'
import { parseModule } from 'magicast'
import remapping from '@ampproject/remapping'
import { normalize, resolve } from 'pathe'
import c from 'tinyrainbow'
import { provider } from 'std-env'
import createDebug from 'debug'
import { cleanUrl } from 'vite-node/utils'
import type { EncodedSourceMap, FetchResult } from 'vite-node'
import { coverageConfigDefaults } from 'vitest/config'
import { BaseCoverageProvider } from 'vitest/coverage'
import type { Vitest, WorkspaceProject } from 'vitest/node'
import type {
  AfterSuiteRunMeta,
  CoverageProvider,
  CoverageV8Options,
  ReportContext,
  ResolvedCoverageOptions,
} from 'vitest'
// @ts-expect-error missing types
import _TestExclude from 'test-exclude'

import { version } from '../package.json' with { type: 'json' }

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

type Options = ResolvedCoverageOptions<'v8'>
type TransformResults = Map<string, FetchResult>
type RawCoverage = Profiler.TakePreciseCoverageReturnType

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
  NonNullable<AfterSuiteRunMeta['projectName']> | typeof DEFAULT_PROJECT,
  Record<
    AfterSuiteRunMeta['transformMode'],
    { [TestFilenames: string]: string }
  >
>

type Entries<T> = [keyof T, T[keyof T]][]

// TODO: vite-node should export this
const WRAPPER_LENGTH = 185

// Note that this needs to match the line ending as well
const VITE_EXPORTS_LINE_PATTERN
  = /Object\.defineProperty\(__vite_ssr_exports__.*\n/g
const DECORATOR_METADATA_PATTERN
  = /_ts_metadata\("design:paramtypes", \[[^\]]*\]\),*/g
const DEFAULT_PROJECT: unique symbol = Symbol.for('default-project')
const FILE_PROTOCOL = 'file://'

const debug = createDebug('vitest:coverage')
let uniqueId = 0

export class V8CoverageProvider extends BaseCoverageProvider implements CoverageProvider {
  name = 'v8'

  ctx!: Vitest
  options!: Options
  testExclude!: InstanceType<TestExclude>

  coverageFiles: CoverageFiles = new Map()
  coverageFilesDirectory!: string
  pendingPromises: Promise<void>[] = []

  initialize(ctx: Vitest): void {
    const config: CoverageV8Options = ctx.config.coverage

    if (ctx.version !== version) {
      ctx.logger.warn(
        c.yellow(
          `Loaded ${c.inverse(c.yellow(` vitest@${ctx.version} `))} and ${c.inverse(c.yellow(` @vitest/coverage-v8@${version} `))}.`
          + '\nRunning mixed versions is not supported and may lead into bugs'
          + '\nUpdate your dependencies and make sure the versions match.',
        ),
      )
    }

    this.ctx = ctx
    this.options = {
      ...coverageConfigDefaults,

      // User's options
      ...config,

      // Resolved fields
      provider: 'v8',
      reporter: this.resolveReporters(
        config.reporter || coverageConfigDefaults.reporter,
      ),
      reportsDirectory: resolve(
        ctx.config.root,
        config.reportsDirectory || coverageConfigDefaults.reportsDirectory,
      ),

      thresholds: config.thresholds && {
        ...config.thresholds,
        lines: config.thresholds['100'] ? 100 : config.thresholds.lines,
        branches: config.thresholds['100'] ? 100 : config.thresholds.branches,
        functions: config.thresholds['100'] ? 100 : config.thresholds.functions,
        statements: config.thresholds['100'] ? 100 : config.thresholds.statements,
      },
    }

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

  resolveOptions(): Options {
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

  /*
   * Coverage and meta information passed from Vitest runners.
   * Note that adding new entries here and requiring on those without
   * backwards compatibility is a breaking change.
   */
  onAfterSuiteRun({ coverage, transformMode, projectName, testFiles }: AfterSuiteRunMeta): void {
    if (transformMode !== 'web' && transformMode !== 'ssr' && transformMode !== 'browser') {
      throw new Error(`Invalid transform mode: ${transformMode}`)
    }

    let entry = this.coverageFiles.get(projectName || DEFAULT_PROJECT)

    if (!entry) {
      entry = { web: { }, ssr: { }, browser: { } }
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

  async generateCoverage({ allTestsRun }: ReportContext): Promise<CoverageMap> {
    const coverageMap = libCoverage.createCoverageMap({})
    let index = 0
    const total = this.pendingPromises.length

    await Promise.all(this.pendingPromises)
    this.pendingPromises = []

    for (const [projectName, coveragePerProject] of this.coverageFiles.entries()) {
      for (const [transformMode, coverageByTestfiles] of Object.entries(coveragePerProject) as Entries<typeof coveragePerProject>) {
        let merged: RawCoverage = { result: [] }

        const filenames = Object.values(coverageByTestfiles)
        const project = this.ctx.projects.find(p => p.getName() === projectName) || this.ctx.getCoreWorkspaceProject()

        for (const chunk of this.toSlices(filenames, this.options.processingConcurrency)) {
          if (debug.enabled) {
            index += chunk.length
            debug('Covered files %d/%d', index, total)
          }

          await Promise.all(chunk.map(async (filename) => {
            const contents = await fs.readFile(filename, 'utf-8')
            const coverage = JSON.parse(contents) as RawCoverage

            merged = mergeProcessCovs([merged, coverage])
          }),
          )
        }

        const converted = await this.convertCoverage(
          merged,
          project,
          transformMode,
        )

        // Source maps can change based on projectName and transform mode.
        // Coverage transform re-uses source maps so we need to separate transforms from each other.
        const transformedCoverage = await transformCoverage(converted)
        coverageMap.merge(transformedCoverage)
      }
    }

    // Include untested files when all tests were run (not a single file re-run)
    // or if previous results are preserved by "cleanOnRerun: false"
    if (this.options.all && (allTestsRun || !this.options.cleanOnRerun)) {
      const coveredFiles = coverageMap.files()
      const untestedCoverage = await this.getUntestedFiles(coveredFiles)

      const converted = await this.convertCoverage(untestedCoverage)
      coverageMap.merge(await transformCoverage(converted))
    }

    if (this.options.excludeAfterRemap) {
      coverageMap.filter(filename => this.testExclude.shouldInstrument(filename))
    }

    return coverageMap
  }

  async reportCoverage(coverageMap: unknown, { allTestsRun }: ReportContext): Promise<void> {
    if (provider === 'stackblitz') {
      this.ctx.logger.log(
        c.blue(' % ')
        + c.yellow(
          '@vitest/coverage-v8 does not work on Stackblitz. Report will be empty.',
        ),
      )
    }

    await this.generateReports(
      (coverageMap as CoverageMap) || libCoverage.createCoverageMap({}),
      allTestsRun,
    )

    // In watch mode we need to preserve the previous results if cleanOnRerun is disabled
    const keepResults = !this.options.cleanOnRerun && this.ctx.config.watch

    if (!keepResults) {
      await this.cleanAfterRun()
    }
  }

  private async cleanAfterRun() {
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

  async generateReports(coverageMap: CoverageMap, allTestsRun?: boolean): Promise<void> {
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

  async mergeReports(coverageMaps: unknown[]): Promise<void> {
    const coverageMap = libCoverage.createCoverageMap({})

    for (const coverage of coverageMaps) {
      coverageMap.merge(coverage as CoverageMap)
    }

    await this.generateReports(coverageMap, true)
  }

  private async getUntestedFiles(testedFiles: string[]): Promise<RawCoverage> {
    const transformResults = normalizeTransformResults(
      this.ctx.vitenode.fetchCache,
    )
    const transform = this.createUncoveredFileTransformer(this.ctx)

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
      .map(file => pathToFileURL(file))
      .filter(file => !testedFiles.includes(file.pathname))

    let merged: RawCoverage = { result: [] }
    let index = 0

    for (const chunk of this.toSlices(
      uncoveredFiles,
      this.options.processingConcurrency,
    )) {
      if (debug.enabled) {
        index += chunk.length
        debug('Uncovered files %d/%d', index, uncoveredFiles.length)
      }

      const coverages = await Promise.all(
        chunk.map(async (filename) => {
          const { originalSource } = await this.getSources(
            filename.href,
            transformResults,
            transform,
          )

          const coverage = {
            url: filename.href,
            scriptId: '0',
            // Create a made up function to mark whole file as uncovered. Note that this does not exist in source maps.
            functions: [
              {
                ranges: [
                  {
                    startOffset: 0,
                    endOffset: originalSource.length,
                    count: 0,
                  },
                ],
                isBlockCoverage: true,
                // This is magical value that indicates an empty report: https://github.com/istanbuljs/v8-to-istanbul/blob/fca5e6a9e6ef38a9cdc3a178d5a6cf9ef82e6cab/lib/v8-to-istanbul.js#LL131C40-L131C40
                functionName: '(empty-report)',
              },
            ],
          }

          return { result: [coverage] }
        }),
      )

      merged = mergeProcessCovs([
        merged,
        ...coverages.filter(
          (cov): cov is NonNullable<typeof cov> => cov != null,
        ),
      ])
    }

    return merged
  }

  private async getSources<TransformResult extends (FetchResult | Awaited<ReturnType<typeof this.ctx.vitenode.transformRequest>>)>(
    url: string,
    transformResults: TransformResults,
    onTransform: (filepath: string) => Promise<TransformResult>,
    functions: Profiler.FunctionCoverage[] = [],
  ): Promise<{
      source: string
      originalSource: string
      sourceMap?: { sourcemap: EncodedSourceMap }
      isExecuted: boolean
    }> {
    const filePath = normalize(fileURLToPath(url))

    let isExecuted = true
    let transformResult: FetchResult | TransformResult | undefined = transformResults.get(filePath)

    if (!transformResult) {
      isExecuted = false
      transformResult = await onTransform(removeStartsWith(url, FILE_PROTOCOL)).catch(() => undefined)
    }

    const map = transformResult?.map as EncodedSourceMap | undefined
    const code = transformResult?.code
    const sourcesContent = map?.sourcesContent || []

    if (!sourcesContent[0]) {
      sourcesContent[0] = await fs.readFile(filePath, 'utf-8').catch(() => {
        // If file does not exist construct a dummy source for it.
        // These can be files that were generated dynamically during the test run and were removed after it.
        const length = findLongestFunctionLength(functions)
        return '.'.repeat(length)
      })
    }

    // These can be uncovered files included by "all: true" or files that are loaded outside vite-node
    if (!map) {
      return {
        isExecuted,
        source: code || sourcesContent[0],
        originalSource: sourcesContent[0],
      }
    }

    const sources = (map.sources || [])
      .filter(source => source != null)
      .map(source => new URL(source, url).href)

    if (sources.length === 0) {
      sources.push(url)
    }

    return {
      isExecuted,
      originalSource: sourcesContent[0],
      source: code || sourcesContent[0],
      sourceMap: {
        sourcemap: excludeGeneratedCode(code, {
          ...map,
          version: 3,
          sources,
          sourcesContent,
        }),
      },
    }
  }

  private async convertCoverage(
    coverage: RawCoverage,
    project: WorkspaceProject = this.ctx.getCoreWorkspaceProject(),
    transformMode?: AfterSuiteRunMeta['transformMode'],
  ): Promise<CoverageMap> {
    let fetchCache = project.vitenode.fetchCache

    if (transformMode) {
      fetchCache = transformMode === 'browser' ? new Map() : project.vitenode.fetchCaches[transformMode]
    }

    const transformResults = normalizeTransformResults(fetchCache)

    async function onTransform(filepath: string) {
      if (transformMode === 'browser' && project.browser) {
        const result = await project.browser.vite.transformRequest(removeStartsWith(filepath, project.config.root))

        if (result) {
          return { ...result, code: `${result.code}// <inline-source-map>` }
        }
      }
      return project.vitenode.transformRequest(filepath)
    }

    const scriptCoverages = []

    for (const result of coverage.result) {
      if (transformMode === 'browser') {
        if (result.url.startsWith('/@fs')) {
          result.url = `${FILE_PROTOCOL}${removeStartsWith(result.url, '/@fs')}`
        }
        else {
          result.url = `${FILE_PROTOCOL}${project.config.root}${result.url}`
        }
      }

      if (this.testExclude.shouldInstrument(fileURLToPath(result.url))) {
        scriptCoverages.push(result)
      }
    }

    const coverageMap = libCoverage.createCoverageMap({})
    let index = 0

    for (const chunk of this.toSlices(scriptCoverages, this.options.processingConcurrency)) {
      if (debug.enabled) {
        index += chunk.length
        debug('Converting %d/%d', index, scriptCoverages.length)
      }

      await Promise.all(
        chunk.map(async ({ url, functions }) => {
          const sources = await this.getSources(
            url,
            transformResults,
            onTransform,
            functions,
          )

          // If file was executed by vite-node we'll need to add its wrapper
          const wrapperLength = sources.isExecuted ? WRAPPER_LENGTH : 0

          const converter = v8ToIstanbul(
            url,
            wrapperLength,
            sources,
            undefined,
            this.options.ignoreEmptyLines,
          )
          await converter.load()

          try {
            converter.applyCoverage(functions)
          }
          catch (error) {
            this.ctx.logger.error(`Failed to convert coverage for ${url}.\n`, error)
          }

          coverageMap.merge(converter.toIstanbul())
        }),
      )
    }

    return coverageMap
  }
}

async function transformCoverage(coverageMap: CoverageMap) {
  const sourceMapStore = libSourceMaps.createSourceMapStore()
  return await sourceMapStore.transformCoverage(coverageMap)
}

/**
 * Remove generated code from the source maps:
 * - Vite's export helpers: e.g. `Object.defineProperty(__vite_ssr_exports__, "sum", { enumerable: true, configurable: true, get(){ return sum }});`
 * - SWC's decorator metadata: e.g. `_ts_metadata("design:paramtypes", [\ntypeof Request === "undefined" ? Object : Request\n]),`
 */
function excludeGeneratedCode(
  source: string | undefined,
  map: EncodedSourceMap,
) {
  if (!source) {
    return map
  }

  if (
    !source.match(VITE_EXPORTS_LINE_PATTERN)
    && !source.match(DECORATOR_METADATA_PATTERN)
  ) {
    return map
  }

  const trimmed = new MagicString(source)
  trimmed.replaceAll(VITE_EXPORTS_LINE_PATTERN, '\n')
  trimmed.replaceAll(DECORATOR_METADATA_PATTERN, match =>
    '\n'.repeat(match.split('\n').length - 1))

  const trimmedMap = trimmed.generateMap({ hires: 'boundary' })

  // A merged source map where the first one excludes generated parts
  const combinedMap = remapping(
    [{ ...trimmedMap, version: 3 }, map],
    () => null,
  )

  return combinedMap as EncodedSourceMap
}

/**
 * Find the function with highest `endOffset` to determine the length of the file
 */
function findLongestFunctionLength(functions: Profiler.FunctionCoverage[]) {
  return functions.reduce((previous, current) => {
    const maxEndOffset = current.ranges.reduce(
      (endOffset, range) => Math.max(endOffset, range.endOffset),
      0,
    )

    return Math.max(previous, maxEndOffset)
  }, 0)
}

function normalizeTransformResults(
  fetchCache: Map<string, { result: FetchResult }>,
) {
  const normalized: TransformResults = new Map()

  for (const [key, value] of fetchCache.entries()) {
    const cleanEntry = cleanUrl(key)

    if (!normalized.has(cleanEntry)) {
      normalized.set(cleanEntry, value.result)
    }
  }

  return normalized
}

function removeStartsWith(filepath: string, start: string) {
  if (filepath.startsWith(start)) {
    return filepath.slice(start.length)
  }

  return filepath
}
