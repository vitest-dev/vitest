import type { CoverageMap } from 'istanbul-lib-coverage'
import type { Profiler } from 'node:inspector'
import type { EncodedSourceMap, FetchResult } from 'vite-node'
import type { AfterSuiteRunMeta } from 'vitest'
import type { CoverageProvider, ReportContext, ResolvedCoverageOptions, TestProject, Vitest } from 'vitest/node'
import { promises as fs } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import remapping from '@ampproject/remapping'
// @ts-expect-error -- untyped
import { mergeProcessCovs } from '@bcoe/v8-coverage'
import createDebug from 'debug'
import libCoverage from 'istanbul-lib-coverage'
import libReport from 'istanbul-lib-report'
import libSourceMaps from 'istanbul-lib-source-maps'
import reports from 'istanbul-reports'
import MagicString from 'magic-string'
import { parseModule } from 'magicast'
import { normalize, resolve } from 'pathe'
import { provider } from 'std-env'
import TestExclude from 'test-exclude'
import c from 'tinyrainbow'
import v8ToIstanbul from 'v8-to-istanbul'
import { cleanUrl } from 'vite-node/utils'

import { BaseCoverageProvider } from 'vitest/coverage'
import { offsetToPosition, originalPositionFor, TraceMap } from 'vitest/utils'
import { version } from '../package.json' with { type: 'json' }

type TransformResults = Map<string, FetchResult>
type RawCoverage = Profiler.TakePreciseCoverageReturnType

// TODO: vite-node should export this
const WRAPPER_LENGTH = 185

const DECORATOR_METADATA_PATTERN
  = /_ts_metadata\("design:paramtypes", \[[^\]]*\]\),*/g
const FILE_PROTOCOL = 'file://'

const debug = createDebug('vitest:coverage')

export class V8CoverageProvider extends BaseCoverageProvider<ResolvedCoverageOptions<'v8'>> implements CoverageProvider {
  name = 'v8' as const
  version = version
  testExclude!: InstanceType<typeof TestExclude>

  initialize(ctx: Vitest): void {
    this._initialize(ctx)

    this.testExclude = new TestExclude({
      cwd: ctx.config.root,
      include: this.options.include,
      exclude: this.options.exclude,
      excludeNodeModules: true,
      extension: this.options.extension,
      relativePath: !this.options.allowExternal,
    })
  }

  createCoverageMap() {
    return libCoverage.createCoverageMap({})
  }

  async generateCoverage({ allTestsRun }: ReportContext): Promise<CoverageMap> {
    const coverageMap = this.createCoverageMap()
    let merged: RawCoverage = { result: [] }

    await this.readCoverageFiles<RawCoverage>({
      onFileRead(coverage) {
        merged = mergeProcessCovs([merged, coverage])
      },
      onFinished: async (project, transformMode) => {
        const converted = await this.convertCoverage(
          merged,
          project,
          transformMode,
        )

        // Source maps can change based on projectName and transform mode.
        // Coverage transform re-uses source maps so we need to separate transforms from each other.
        const transformedCoverage = await transformCoverage(converted)
        coverageMap.merge(transformedCoverage)

        merged = { result: [] }
      },
      onDebug: debug,
    })

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

  async generateReports(coverageMap: CoverageMap, allTestsRun?: boolean): Promise<void> {
    if (provider === 'stackblitz') {
      this.ctx.logger.log(
        c.blue(' % ')
        + c.yellow(
          '@vitest/coverage-v8 does not work on Stackblitz. Report will be empty.',
        ),
      )
    }

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
      await this.reportThresholds(coverageMap, allTestsRun)
    }
  }

  async parseConfigModule(configFilePath: string) {
    return parseModule(
      await fs.readFile(configFilePath, 'utf8'),
    )
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

    for (const chunk of this.toSlices(uncoveredFiles, this.options.processingConcurrency)) {
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
    project: TestProject = this.ctx.getRootProject(),
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

    const coverageMap = this.createCoverageMap()
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

          // filter out functions without mappings,
          // for example, "export getter" injected by Vite ssr transform.
          // https://github.com/vitest-dev/vitest/issues/7130
          if (sources.isExecuted && sources.sourceMap) {
            const traceMap = new TraceMap(sources.sourceMap.sourcemap)
            functions = functions.filter((f) => {
              if (f.ranges.length === 1) {
                const start = f.ranges[0].startOffset - wrapperLength
                const end = f.ranges[0].endOffset - wrapperLength - 1
                if ([start, end].every(offset => offset >= 0 && offset < sources.source.length)) {
                  const startPos = offsetToPosition(sources.source, start)
                  const endPos = offsetToPosition(sources.source, end)
                  const startSourcePos = originalPositionFor(traceMap, startPos)
                  const endSourcePos = originalPositionFor(traceMap, endPos)
                  if (startSourcePos.line === null && endSourcePos.line === null) {
                    return false
                  }
                }
              }
              return true
            })
          }

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

  if (!source.match(DECORATOR_METADATA_PATTERN)) {
    return map
  }

  const trimmed = new MagicString(source)
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
