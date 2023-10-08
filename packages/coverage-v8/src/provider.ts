import { existsSync, promises as fs } from 'node:fs'
import type { Profiler } from 'node:inspector'
import { fileURLToPath, pathToFileURL } from 'node:url'
import v8ToIstanbul from 'v8-to-istanbul'
import { mergeProcessCovs } from '@bcoe/v8-coverage'
import libReport from 'istanbul-lib-report'
import reports, { type ReportOptions } from 'istanbul-reports'
import type { CoverageMap } from 'istanbul-lib-coverage'
import libCoverage from 'istanbul-lib-coverage'
import libSourceMaps from 'istanbul-lib-source-maps'
import MagicString from 'magic-string'
import remapping from '@ampproject/remapping'
import { normalize, resolve } from 'pathe'
import c from 'picocolors'
import { provider } from 'std-env'
import { cleanUrl } from 'vite-node/utils'
import type { EncodedSourceMap, FetchResult } from 'vite-node'
import { coverageConfigDefaults, defaultExclude, defaultInclude } from 'vitest/config'
import { BaseCoverageProvider } from 'vitest/coverage'
import type { AfterSuiteRunMeta, CoverageProvider, CoverageV8Options, ReportContext, ResolvedCoverageOptions } from 'vitest'
import type { Vitest } from 'vitest/node'

// @ts-expect-error missing types
import _TestExclude from 'test-exclude'

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

type Options = ResolvedCoverageOptions<'v8'>
type TransformResults = Map<string, FetchResult>

// TODO: vite-node should export this
const WRAPPER_LENGTH = 185

// Note that this needs to match the line ending as well
const VITE_EXPORTS_LINE_PATTERN = /Object\.defineProperty\(__vite_ssr_exports__.*\n/g

export class V8CoverageProvider extends BaseCoverageProvider implements CoverageProvider {
  name = 'v8'

  ctx!: Vitest
  options!: Options
  testExclude!: InstanceType<TestExclude>
  coverages: Profiler.TakePreciseCoverageReturnType[] = []

  initialize(ctx: Vitest) {
    const config: CoverageV8Options = ctx.config.coverage

    this.ctx = ctx
    this.options = {
      ...coverageConfigDefaults,

      // User's options
      ...config,

      // Resolved fields
      provider: 'v8',
      reporter: this.resolveReporters(config.reporter || coverageConfigDefaults.reporter),
      reportsDirectory: resolve(ctx.config.root, config.reportsDirectory || coverageConfigDefaults.reportsDirectory),
      lines: config['100'] ? 100 : config.lines,
      functions: config['100'] ? 100 : config.functions,
      branches: config['100'] ? 100 : config.branches,
      statements: config['100'] ? 100 : config.statements,
    }

    this.testExclude = new _TestExclude({
      cwd: ctx.config.root,
      include: typeof this.options.include === 'undefined' ? undefined : [...this.options.include],
      exclude: [...defaultExclude, ...defaultInclude, ...this.options.exclude],
      excludeNodeModules: true,
      extension: this.options.extension,
      relativePath: !this.options.allowExternal,
    })
  }

  resolveOptions() {
    return this.options
  }

  async clean(clean = true) {
    if (clean && existsSync(this.options.reportsDirectory))
      await fs.rm(this.options.reportsDirectory, { recursive: true, force: true, maxRetries: 10 })

    this.coverages = []
  }

  onAfterSuiteRun({ coverage }: AfterSuiteRunMeta) {
    this.coverages.push(coverage as Profiler.TakePreciseCoverageReturnType)
  }

  async reportCoverage({ allTestsRun }: ReportContext = {}) {
    if (provider === 'stackblitz')
      this.ctx.logger.log(c.blue(' % ') + c.yellow('@vitest/coverage-v8 does not work on Stackblitz. Report will be empty.'))

    const transformResults = normalizeTransformResults(this.ctx.projects.map(project => project.vitenode.fetchCache))
    const merged = mergeProcessCovs(this.coverages)
    const scriptCoverages = merged.result.filter(result => this.testExclude.shouldInstrument(fileURLToPath(result.url)))

    if (this.options.all && allTestsRun) {
      const coveredFiles = Array.from(scriptCoverages.map(r => r.url))
      const untestedFiles = await this.getUntestedFiles(coveredFiles, transformResults)

      scriptCoverages.push(...untestedFiles)
    }

    const converted = await Promise.all(scriptCoverages.map(async ({ url, functions }) => {
      const sources = await this.getSources(url, transformResults, functions)

      // If no source map was found from vite-node we can assume this file was not run in the wrapper
      const wrapperLength = sources.sourceMap ? WRAPPER_LENGTH : 0

      const converter = v8ToIstanbul(url, wrapperLength, sources)
      await converter.load()

      converter.applyCoverage(functions)
      return converter.toIstanbul()
    }))

    const mergedCoverage = converted.reduce((coverage, previousCoverageMap) => {
      const map = libCoverage.createCoverageMap(coverage)
      map.merge(previousCoverageMap)
      return map
    }, libCoverage.createCoverageMap({}))

    const sourceMapStore = libSourceMaps.createSourceMapStore()
    const coverageMap: CoverageMap = await sourceMapStore.transformCoverage(mergedCoverage)

    const context = libReport.createContext({
      dir: this.options.reportsDirectory,
      coverageMap,
      sourceFinder: sourceMapStore.sourceFinder,
      watermarks: this.options.watermarks,
    })

    if (hasTerminalReporter(this.options.reporter))
      this.ctx.logger.log(c.blue(' % ') + c.dim('Coverage report from ') + c.yellow(this.name))

    for (const reporter of this.options.reporter) {
      reports.create(reporter[0] as keyof ReportOptions, {
        skipFull: this.options.skipFull,
        projectRoot: this.ctx.config.root,
        ...reporter[1],
      }).execute(context)
    }

    if (this.options.branches
      || this.options.functions
      || this.options.lines
      || this.options.statements) {
      this.checkThresholds({
        coverageMap,
        thresholds: {
          branches: this.options.branches,
          functions: this.options.functions,
          lines: this.options.lines,
          statements: this.options.statements,
        },
        perFile: this.options.perFile,
      })
    }

    if (this.options.thresholdAutoUpdate && allTestsRun) {
      this.updateThresholds({
        coverageMap,
        thresholds: {
          branches: this.options.branches,
          functions: this.options.functions,
          lines: this.options.lines,
          statements: this.options.statements,
        },
        perFile: this.options.perFile,
        configurationFile: this.ctx.server.config.configFile,
      })
    }
  }

  private async getUntestedFiles(testedFiles: string[], transformResults: TransformResults): Promise<Profiler.ScriptCoverage[]> {
    const includedFiles = await this.testExclude.glob(this.ctx.config.root)
    const uncoveredFiles = includedFiles
      .map(file => pathToFileURL(resolve(this.ctx.config.root, file)))
      .filter(file => !testedFiles.includes(file.href))

    return await Promise.all(uncoveredFiles.map(async (uncoveredFile) => {
      const { source } = await this.getSources(uncoveredFile.href, transformResults)

      return {
        url: uncoveredFile.href,
        scriptId: '0',
        // Create a made up function to mark whole file as uncovered. Note that this does not exist in source maps.
        functions: [{
          ranges: [{
            startOffset: 0,
            endOffset: source.length,
            count: 0,
          }],
          isBlockCoverage: true,
          // This is magical value that indicates an empty report: https://github.com/istanbuljs/v8-to-istanbul/blob/fca5e6a9e6ef38a9cdc3a178d5a6cf9ef82e6cab/lib/v8-to-istanbul.js#LL131C40-L131C40
          functionName: '(empty-report)',
        }],
      }
    }))
  }

  private async getSources(url: string, transformResults: TransformResults, functions: Profiler.FunctionCoverage[] = []): Promise<{
    source: string
    originalSource?: string
    sourceMap?: { sourcemap: EncodedSourceMap }
  }> {
    const filePath = normalize(fileURLToPath(url))

    const transformResult = transformResults.get(filePath)

    const map = transformResult?.map
    const code = transformResult?.code
    const sourcesContent = map?.sourcesContent?.[0] || await fs.readFile(filePath, 'utf-8').catch(() => {
      // If file does not exist construct a dummy source for it.
      // These can be files that were generated dynamically during the test run and were removed after it.
      const length = findLongestFunctionLength(functions)
      return '.'.repeat(length)
    })

    // These can be uncovered files included by "all: true" or files that are loaded outside vite-node
    if (!map)
      return { source: code || sourcesContent }

    return {
      originalSource: sourcesContent,
      source: code || sourcesContent,
      sourceMap: {
        sourcemap: removeViteHelpersFromSourceMaps(code, {
          ...map,
          version: 3,
          sources: [url],
          sourcesContent: [sourcesContent],
        }),
      },
    }
  }
}

/**
 * Remove generated code from the source maps:
 * - Vite's export helpers: e.g. `Object.defineProperty(__vite_ssr_exports__, "sum", { enumerable: true, configurable: true, get(){ return sum }});`
 */
function removeViteHelpersFromSourceMaps(source: string | undefined, map: EncodedSourceMap) {
  if (!source || !source.match(VITE_EXPORTS_LINE_PATTERN))
    return map

  const sourceWithoutHelpers = new MagicString(source)
  sourceWithoutHelpers.replaceAll(VITE_EXPORTS_LINE_PATTERN, '\n')

  const mapWithoutHelpers = sourceWithoutHelpers.generateMap({
    hires: true,
  })

  // A merged source map where the first one excludes helpers
  const combinedMap = remapping(
    [{ ...mapWithoutHelpers, version: 3 }, map],
    () => null,
  )

  return combinedMap as EncodedSourceMap
}

/**
 * Find the function with highest `endOffset` to determine the length of the file
 */
function findLongestFunctionLength(functions: Profiler.FunctionCoverage[]) {
  return functions.reduce((previous, current) => {
    const maxEndOffset = current.ranges.reduce((endOffset, range) => Math.max(endOffset, range.endOffset), 0)

    return Math.max(previous, maxEndOffset)
  }, 0)
}

function normalizeTransformResults(fetchCaches: Map<string, { result: FetchResult }>[]) {
  const normalized: TransformResults = new Map()

  for (const fetchCache of fetchCaches) {
    for (const [key, value] of fetchCache.entries()) {
      const cleanEntry = cleanUrl(key)

      if (!normalized.has(cleanEntry))
        normalized.set(cleanEntry, value.result)
    }
  }

  return normalized
}

function hasTerminalReporter(reporters: Options['reporter']) {
  return reporters.some(([reporter]) =>
    reporter === 'text'
    || reporter === 'text-summary'
    || reporter === 'text-lcov'
    || reporter === 'teamcity')
}
