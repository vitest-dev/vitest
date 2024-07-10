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
import { stripLiteral } from 'strip-literal'
import createDebug from 'debug'
import { cleanUrl } from 'vite-node/utils'
import type { EncodedSourceMap, FetchResult } from 'vite-node'
import {
  coverageConfigDefaults,
} from 'vitest/config'
import { BaseCoverageProvider } from 'vitest/coverage'
import type {
  AfterSuiteRunMeta,
  CoverageProvider,
  CoverageV8Options,
  ReportContext,
  ResolvedCoverageOptions,
} from 'vitest'
import type { Vitest } from 'vitest/node'

// @ts-expect-error missing types
import _TestExclude from 'test-exclude'

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
type Filename = string
type RawCoverage = Profiler.TakePreciseCoverageReturnType
type CoverageFilesByTransformMode = Record<
  AfterSuiteRunMeta['transformMode'],
  Filename[]
>
type ProjectName =
  | NonNullable<AfterSuiteRunMeta['projectName']>
  | typeof DEFAULT_PROJECT

// TODO: vite-node should export this
const WRAPPER_LENGTH = 185

// Note that this needs to match the line ending as well
const VITE_EXPORTS_LINE_PATTERN
  = /Object\.defineProperty\(__vite_ssr_exports__.*\n/g
const DECORATOR_METADATA_PATTERN
  = /_ts_metadata\("design:paramtypes", \[[^\]]*\]\),*/g
const DEFAULT_PROJECT = Symbol.for('default-project')

const debug = createDebug('vitest:coverage')
let uniqueId = 0

export class V8CoverageProvider
  extends BaseCoverageProvider
  implements CoverageProvider {
  name = 'v8'

  ctx!: Vitest
  options!: Options
  testExclude!: InstanceType<TestExclude>

  coverageFiles = new Map<ProjectName, CoverageFilesByTransformMode>()
  coverageFilesDirectory!: string
  pendingPromises: Promise<void>[] = []

  initialize(ctx: Vitest) {
    const config: CoverageV8Options = ctx.config.coverage

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
        statements: config.thresholds['100']
          ? 100
          : config.thresholds.statements,
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

  resolveOptions() {
    return this.options
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

  /*
   * Coverage and meta information passed from Vitest runners.
   * Note that adding new entries here and requiring on those without
   * backwards compatibility is a breaking change.
   */
  onAfterSuiteRun({ coverage, transformMode, projectName }: AfterSuiteRunMeta) {
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

  async generateCoverage({ allTestsRun }: ReportContext) {
    const coverageMap = libCoverage.createCoverageMap({})
    let index = 0
    const total = this.pendingPromises.length

    await Promise.all(this.pendingPromises)
    this.pendingPromises = []

    for (const [
      projectName,
      coveragePerProject,
    ] of this.coverageFiles.entries()) {
      for (const [transformMode, filenames] of Object.entries(
        coveragePerProject,
      ) as [AfterSuiteRunMeta['transformMode'], Filename[]][]) {
        let merged: RawCoverage = { result: [] }

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
              const coverage = JSON.parse(contents) as RawCoverage
              merged = mergeProcessCovs([merged, coverage])
            }),
          )
        }

        const converted = await this.convertCoverage(
          merged,
          projectName,
          transformMode,
        )

        // Source maps can change based on projectName and transform mode.
        // Coverage transform re-uses source maps so we need to separate transforms from each other.
        const transformedCoverage = await transformCoverage(converted)
        coverageMap.merge(transformedCoverage)
      }
    }

    if (this.options.all && allTestsRun) {
      const coveredFiles = coverageMap.files()
      const untestedCoverage = await this.getUntestedFiles(coveredFiles)

      const converted = await this.convertCoverage(untestedCoverage)
      coverageMap.merge(await transformCoverage(converted))
    }

    return coverageMap
  }

  async reportCoverage(coverageMap: unknown, { allTestsRun }: ReportContext) {
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
      this.coverageFiles = new Map()
      await fs.rm(this.coverageFilesDirectory, { recursive: true })

      // Remove empty reports directory, e.g. when only text-reporter is used
      if (readdirSync(this.options.reportsDirectory).length === 0) {
        await fs.rm(this.options.reportsDirectory, { recursive: true })
      }
    }
  }

  async generateReports(coverageMap: CoverageMap, allTestsRun?: boolean) {
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

  private async getUntestedFiles(testedFiles: string[]): Promise<RawCoverage> {
    const transformResults = normalizeTransformResults(
      this.ctx.vitenode.fetchCache,
    )

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
          const { originalSource, source } = await this.getSources(
            filename.href,
            transformResults,
          )

          // Ignore empty files, e.g. files that contain only typescript types and no runtime code
          if (source && stripLiteral(source).trim() === '') {
            return null
          }

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

  private async getSources(
    url: string,
    transformResults: TransformResults,
    functions: Profiler.FunctionCoverage[] = [],
  ): Promise<{
      source: string
      originalSource: string
      sourceMap?: { sourcemap: EncodedSourceMap }
      isExecuted: boolean
    }> {
    const filePath = normalize(fileURLToPath(url))

    let isExecuted = true
    let transformResult:
      | FetchResult
      | Awaited<ReturnType<typeof this.ctx.vitenode.transformRequest>>
      = transformResults.get(filePath)

    if (!transformResult) {
      isExecuted = false
      transformResult = await this.ctx.vitenode
        .transformRequest(filePath)
        .catch(() => null)
    }

    const map = transformResult?.map as EncodedSourceMap | undefined
    const code = transformResult?.code
    const sourcesContent
      = map?.sourcesContent?.[0]
      || (await fs.readFile(filePath, 'utf-8').catch(() => {
        // If file does not exist construct a dummy source for it.
        // These can be files that were generated dynamically during the test run and were removed after it.
        const length = findLongestFunctionLength(functions)
        return '.'.repeat(length)
      }))

    // These can be uncovered files included by "all: true" or files that are loaded outside vite-node
    if (!map) {
      return {
        isExecuted,
        source: code || sourcesContent,
        originalSource: sourcesContent,
      }
    }

    const sources = [url]
    if (map.sources && map.sources[0] && !url.endsWith(map.sources[0])) {
      sources[0] = new URL(map.sources[0], url).href
    }

    return {
      isExecuted,
      originalSource: sourcesContent,
      source: code || sourcesContent,
      sourceMap: {
        sourcemap: excludeGeneratedCode(code, {
          ...map,
          version: 3,
          sources,
          sourcesContent: [sourcesContent],
        }),
      },
    }
  }

  private async convertCoverage(
    coverage: RawCoverage,
    projectName?: ProjectName,
    transformMode?: 'web' | 'ssr',
  ): Promise<CoverageMap> {
    const viteNode
      = this.ctx.projects.find(project => project.getName() === projectName)
        ?.vitenode || this.ctx.vitenode
    const fetchCache = transformMode
      ? viteNode.fetchCaches[transformMode]
      : viteNode.fetchCache
    const transformResults = normalizeTransformResults(fetchCache)

    const scriptCoverages = coverage.result.filter(result =>
      this.testExclude.shouldInstrument(fileURLToPath(result.url)),
    )
    const coverageMap = libCoverage.createCoverageMap({})
    let index = 0

    for (const chunk of this.toSlices(
      scriptCoverages,
      this.options.processingConcurrency,
    )) {
      if (debug.enabled) {
        index += chunk.length
        debug('Converting %d/%d', index, scriptCoverages.length)
      }

      await Promise.all(
        chunk.map(async ({ url, functions }) => {
          const sources = await this.getSources(
            url,
            transformResults,
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

          converter.applyCoverage(functions)
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
