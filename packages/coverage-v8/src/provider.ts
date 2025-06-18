import type { CoverageMap } from 'istanbul-lib-coverage'
import type { ProxifiedModule } from 'magicast'
import type { Profiler } from 'node:inspector'
import type { EncodedSourceMap, FetchResult } from 'vite-node'
import type { AfterSuiteRunMeta } from 'vitest'
import type { CoverageProvider, ReportContext, ResolvedCoverageOptions, TestProject, Vitest } from 'vitest/node'
import { promises as fs } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import remapping from '@ampproject/remapping'
// @ts-expect-error -- untyped
import { mergeProcessCovs } from '@bcoe/v8-coverage'
import astV8ToIstanbul from 'ast-v8-to-istanbul'
import createDebug from 'debug'
import libCoverage from 'istanbul-lib-coverage'
import libReport from 'istanbul-lib-report'
import libSourceMaps from 'istanbul-lib-source-maps'
import reports from 'istanbul-reports'
import MagicString from 'magic-string'
import { parseModule } from 'magicast'
import { normalize } from 'pathe'
import { provider } from 'std-env'
import c from 'tinyrainbow'
import v8ToIstanbul from 'v8-to-istanbul'
import { cleanUrl } from 'vite-node/utils'

import { BaseCoverageProvider } from 'vitest/coverage'
import { parseAstAsync } from 'vitest/node'
import { version } from '../package.json' with { type: 'json' }

export interface ScriptCoverageWithOffset extends Profiler.ScriptCoverage {
  startOffset: number
}

type TransformResults = Map<string, FetchResult>
interface RawCoverage { result: ScriptCoverageWithOffset[] }

// Note that this needs to match the line ending as well
const VITE_EXPORTS_LINE_PATTERN
  = /Object\.defineProperty\(__vite_ssr_exports__.*\n/g
const DECORATOR_METADATA_PATTERN
  = /_ts_metadata\("design:paramtypes", \[[^\]]*\]\),*/g
const FILE_PROTOCOL = 'file://'

const debug = createDebug('vitest:coverage')

export class V8CoverageProvider extends BaseCoverageProvider<ResolvedCoverageOptions<'v8'>> implements CoverageProvider {
  name = 'v8' as const
  version: string = version

  initialize(ctx: Vitest): void {
    this._initialize(ctx)
  }

  createCoverageMap(): CoverageMap {
    return libCoverage.createCoverageMap({})
  }

  async generateCoverage({ allTestsRun }: ReportContext): Promise<CoverageMap> {
    const start = debug.enabled ? performance.now() : 0

    const coverageMap = this.createCoverageMap()
    let merged: RawCoverage = { result: [] }

    await this.readCoverageFiles<RawCoverage>({
      onFileRead(coverage) {
        merged = mergeProcessCovs([merged, coverage])

        // mergeProcessCovs sometimes loses startOffset, e.g. in vue
        merged.result.forEach((result) => {
          if (!result.startOffset) {
            const original = coverage.result.find(r => r.url === result.url)
            result.startOffset = original?.startOffset || 0
          }
        })
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
    if (this.options.include != null && (allTestsRun || !this.options.cleanOnRerun)) {
      const coveredFiles = coverageMap.files()
      const untestedCoverage = await this.getCoverageMapForUncoveredFiles(coveredFiles)

      coverageMap.merge(await transformCoverage(untestedCoverage))
    }

    if (this.options.excludeAfterRemap) {
      coverageMap.filter(filename => this.isIncluded(filename))
    }

    if (debug.enabled) {
      debug(`Generate coverage total time ${(performance.now() - start!).toFixed()} ms`)
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

  async parseConfigModule(configFilePath: string): Promise<ProxifiedModule<any>> {
    return parseModule(
      await fs.readFile(configFilePath, 'utf8'),
    )
  }

  private async getCoverageMapForUncoveredFiles(testedFiles: string[]): Promise<CoverageMap> {
    const transformResults = normalizeTransformResults(
      this.ctx.vitenode.fetchCache,
    )
    const transform = this.createUncoveredFileTransformer(this.ctx)

    const uncoveredFiles = await this.getUntestedFiles(testedFiles)

    let index = 0

    const coverageMap = this.createCoverageMap()

    for (const chunk of this.toSlices(uncoveredFiles, this.options.processingConcurrency)) {
      if (debug.enabled) {
        index += chunk.length
        debug('Uncovered files %d/%d', index, uncoveredFiles.length)
      }

      await Promise.all(chunk.map(async (filename) => {
        let timeout: ReturnType<typeof setTimeout> | undefined
        let start: number | undefined

        if (debug.enabled) {
          start = performance.now()
          timeout = setTimeout(() => debug(c.bgRed(`File "${filename}" is taking longer than 3s`)), 3_000)
        }

        const url = pathToFileURL(filename)
        const sources = await this.getSources(
          url.href,
          transformResults,
          transform,
        )

        coverageMap.merge(await this.v8ToIstanbul(
          url.href,
          0,
          sources,
          [{
            ranges: [
              {
                startOffset: 0,
                endOffset: sources.originalSource.length,
                count: 0,
              },
            ],
            isBlockCoverage: true,
            // This is magical value that indicates an empty report: https://github.com/istanbuljs/v8-to-istanbul/blob/fca5e6a9e6ef38a9cdc3a178d5a6cf9ef82e6cab/lib/v8-to-istanbul.js#LL131C40-L131C40
            functionName: '(empty-report)',
          }],
        ))

        if (debug.enabled) {
          clearTimeout(timeout)

          const diff = performance.now() - start!
          const color = diff > 500 ? c.bgRed : c.bgGreen
          debug(`${color(` ${diff.toFixed()} ms `)} ${filename}`)
        }
      }))
    }

    return coverageMap
  }

  private async v8ToIstanbul(filename: string, wrapperLength: number, sources: Awaited<ReturnType<typeof this.getSources>>, functions: Profiler.FunctionCoverage[]) {
    if (this.options.experimentalAstAwareRemapping) {
      let ast
      try {
        ast = await parseAstAsync(sources.source)
      }
      catch (error) {
        this.ctx.logger.error(`Failed to parse ${filename}. Excluding it from coverage.\n`, error)
        return {}
      }

      return await astV8ToIstanbul({
        code: sources.source,
        sourceMap: sources.sourceMap?.sourcemap,
        ast,
        coverage: { functions, url: filename },
        ignoreClassMethods: this.options.ignoreClassMethods,
        wrapperLength,
        ignoreNode: (node, type) => {
          // SSR transformed imports
          if (
            type === 'statement'
            && node.type === 'VariableDeclarator'
            && node.id.type === 'Identifier'
            && node.id.name.startsWith('__vite_ssr_import_')
          ) {
            return true
          }

          // SSR transformed exports vite@>6.3.5
          if (
            type === 'statement'
            && node.type === 'ExpressionStatement'
            && node.expression.type === 'AssignmentExpression'
            && node.expression.left.type === 'MemberExpression'
            && node.expression.left.object.type === 'Identifier'
            && node.expression.left.object.name === '__vite_ssr_exports__'
          ) {
            return true
          }

          // SSR transformed exports vite@^6.3.5
          if (
            type === 'statement'
            && node.type === 'VariableDeclarator'
            && node.id.type === 'Identifier'
            && node.id.name === '__vite_ssr_export_default__'
          ) {
            return true
          }

          // in-source test with "if (import.meta.vitest)"
          if (
            (type === 'branch' || type === 'statement')
            && node.type === 'IfStatement'
            && node.test.type === 'MemberExpression'
            && node.test.property.type === 'Identifier'
            && node.test.property.name === 'vitest'
          ) {
            // SSR
            if (
              node.test.object.type === 'Identifier'
              && node.test.object.name === '__vite_ssr_import_meta__'
            ) {
              return 'ignore-this-and-nested-nodes'
            }

            // Web
            if (
              node.test.object.type === 'MetaProperty'
              && node.test.object.meta.name === 'import'
              && node.test.object.property.name === 'meta'
            ) {
              return 'ignore-this-and-nested-nodes'
            }
          }

          // Browser mode's "import.meta.env ="
          if (
            type === 'statement'
            && node.type === 'ExpressionStatement'
            && node.expression.type === 'AssignmentExpression'
            && node.expression.left.type === 'MemberExpression'
            && node.expression.left.object.type === 'MetaProperty'
            && node.expression.left.object.meta.name === 'import'
            && node.expression.left.object.property.name === 'meta'
            && node.expression.left.property.type === 'Identifier'
            && node.expression.left.property.name === 'env') {
            return true
          }
        },
      },
      )
    }

    const converter = v8ToIstanbul(
      filename,
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
      this.ctx.logger.error(`Failed to convert coverage for ${filename}.\n`, error)
    }

    return converter.toIstanbul()
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
    }> {
    const filePath = normalize(fileURLToPath(url))

    let transformResult: FetchResult | TransformResult | undefined = transformResults.get(filePath)

    if (!transformResult) {
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
        return '/'.repeat(length)
      })
    }

    // These can be uncovered files picked by "coverage.include" or files that are loaded outside vite-node
    if (!map) {
      return {
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
        else if (result.url.startsWith(project.config.root)) {
          result.url = `${FILE_PROTOCOL}${result.url}`
        }
        else {
          result.url = `${FILE_PROTOCOL}${project.config.root}${result.url}`
        }
      }

      if (this.isIncluded(fileURLToPath(result.url))) {
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
        chunk.map(async ({ url, functions, startOffset }) => {
          let timeout: ReturnType<typeof setTimeout> | undefined
          let start: number | undefined

          if (debug.enabled) {
            start = performance.now()
            timeout = setTimeout(() => debug(c.bgRed(`File "${fileURLToPath(url)}" is taking longer than 3s`)), 3_000)
          }

          const sources = await this.getSources(
            url,
            transformResults,
            onTransform,
            functions,
          )

          coverageMap.merge(await this.v8ToIstanbul(
            url,
            startOffset,
            sources,
            functions,
          ))

          if (debug.enabled) {
            clearTimeout(timeout)

            const diff = performance.now() - start!
            const color = diff > 500 ? c.bgRed : c.bgGreen
            debug(`${color(` ${diff.toFixed()} ms `)} ${fileURLToPath(url)}`)
          }
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
