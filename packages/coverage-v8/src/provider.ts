import type { CoverageMap, FileCoverageData } from 'istanbul-lib-coverage'
import type { ProxifiedModule } from 'magicast'
import type { Profiler } from 'node:inspector'
import type { CoverageProvider, ReportContext, ResolvedCoverageOptions, TestProject, Vite, Vitest } from 'vitest/node'
import { existsSync, promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
// @ts-expect-error -- untyped
import { mergeProcessCovs } from '@bcoe/v8-coverage'
import astV8ToIstanbul from 'ast-v8-to-istanbul'
import libCoverage from 'istanbul-lib-coverage'
import libReport from 'istanbul-lib-report'
import reports from 'istanbul-reports'
import { parseModule } from 'magicast'
import { createDebug } from 'obug'
import { normalize } from 'pathe'
import { provider } from 'std-env'
import c from 'tinyrainbow'
import { BaseCoverageProvider } from 'vitest/coverage'
import { parseAstAsync } from 'vitest/node'
import { version } from '../package.json' with { type: 'json' }

// Types for location-based coverage matching
interface Location {
  start: { line: number; column: number | null }
  end: { line: number; column: number | null }
}

interface FnMapEntry {
  name: string
  decl: Location
  loc: Location
}

interface BranchMapEntry {
  type: string
  loc: Location
  locations: Location[]
}

/**
 * Create a unique key for a location using only start position.
 * This ignores end column differences that occur between different transform modes
 * (SSR vs browser), which produce slightly different source map positions.
 */
function locationKey(loc: Location): string {
  return `${loc.start.line}:${loc.start.column}`
}

/**
 * Get the line number from a location for fallback matching
 */
function lineKey(loc: Location): number {
  return loc.start.line
}

interface CoverageLookups {
  stmts: Map<string, number>
  stmtsByLine: Map<number, number>
  fns: Map<string, number>
  fnsByLine: Map<number, number>
  branches: Map<string, number[]>
  branchesByLine: Map<number, number[]>
}

/**
 * Build lookup maps from file coverage data for efficient merging.
 * Creates maps keyed by exact location and by line number for fallback matching.
 */
function buildLookups(data: FileCoverageData): CoverageLookups {
  const stmts = new Map<string, number>()
  const stmtsByLine = new Map<number, number>()
  for (const [key, loc] of Object.entries(data.statementMap || {}) as [string, Location][]) {
    const count = data.s[key] || 0
    stmts.set(locationKey(loc), count)
    const line = lineKey(loc)
    stmtsByLine.set(line, Math.max(stmtsByLine.get(line) || 0, count))
  }

  const fns = new Map<string, number>()
  const fnsByLine = new Map<number, number>()
  for (const [key, fn] of Object.entries(data.fnMap || {}) as [string, FnMapEntry][]) {
    const count = data.f[key] || 0
    fns.set(locationKey(fn.loc), count)
    const line = lineKey(fn.loc)
    fnsByLine.set(line, Math.max(fnsByLine.get(line) || 0, count))
  }

  const branches = new Map<string, number[]>()
  const branchesByLine = new Map<number, number[]>()
  for (const [key, branch] of Object.entries(data.branchMap || {}) as [string, BranchMapEntry][]) {
    const counts = data.b[key] || []
    branches.set(locationKey(branch.loc), counts)
    const line = lineKey(branch.loc)
    if (!branchesByLine.has(line)) {
      branchesByLine.set(line, counts)
    }
  }

  return { stmts, stmtsByLine, fns, fnsByLine, branches, branchesByLine }
}

/**
 * Smart merge of coverage maps that handles different source map positions.
 *
 * When the same file is covered by multiple projects with different transform modes
 * (e.g., SSR vs browser), the source maps can produce slightly different statement
 * end positions. Istanbul's native merge() treats these as different statements,
 * causing inflated counts.
 *
 * This function uses start position-based matching (ignoring end column differences)
 * to correctly merge execution counts without duplicating statements.
 */
function smartMergeCoverageMaps(target: CoverageMap, source: CoverageMap): void {
  for (const filename of source.files()) {
    if (!target.files().includes(filename)) {
      // File only in source - add as-is
      target.addFileCoverage(source.fileCoverageFor(filename))
      continue
    }

    // File exists in both - smart merge using location-based matching
    const targetData = target.fileCoverageFor(filename).toJSON() as FileCoverageData
    const sourceData = source.fileCoverageFor(filename).toJSON() as FileCoverageData
    const sourceLookups = buildLookups(sourceData)

    // Merge statement counts using start position matching
    for (const [key, loc] of Object.entries(targetData.statementMap) as [string, Location][]) {
      const locKey = locationKey(loc)
      const line = lineKey(loc)
      // Try exact location match first, then fallback to line-based match
      const sourceCount = sourceLookups.stmts.get(locKey) ?? sourceLookups.stmtsByLine.get(line)
      if (sourceCount !== undefined) {
        targetData.s[key] = Math.max(targetData.s[key] || 0, sourceCount)
      }
    }

    // Merge function counts
    for (const [key, fn] of Object.entries(targetData.fnMap) as [string, FnMapEntry][]) {
      const locKey = locationKey(fn.loc)
      const line = lineKey(fn.loc)
      const sourceCount = sourceLookups.fns.get(locKey) ?? sourceLookups.fnsByLine.get(line)
      if (sourceCount !== undefined) {
        targetData.f[key] = Math.max(targetData.f[key] || 0, sourceCount)
      }
    }

    // Merge branch counts
    for (const [key, branch] of Object.entries(targetData.branchMap) as [string, BranchMapEntry][]) {
      const locKey = locationKey(branch.loc)
      const line = lineKey(branch.loc)
      const sourceCounts = sourceLookups.branches.get(locKey) ?? sourceLookups.branchesByLine.get(line)
      if (sourceCounts !== undefined) {
        const targetCounts = targetData.b[key] || []
        targetData.b[key] = targetCounts.map((c: number, i: number) =>
          Math.max(c, sourceCounts[i] || 0),
        )
      }
    }

    // Update target with merged data
    target.addFileCoverage(libCoverage.createFileCoverage(targetData))
  }
}

export interface ScriptCoverageWithOffset extends Profiler.ScriptCoverage {
  startOffset: number
}

interface RawCoverage { result: ScriptCoverageWithOffset[] }

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
      onFinished: async (project, environment) => {
        // Source maps can change based on projectName and transform mode.
        // Coverage transform re-uses source maps so we need to separate transforms from each other.
        const converted = await this.convertCoverage(
          merged,
          project,
          environment,
        )

        // Use smart merge to handle different source map positions across projects.
        // Different transform modes (SSR vs browser) can produce slightly different
        // statement end positions for the same source location. Istanbul's native
        // merge() would treat these as different statements, inflating counts.
        smartMergeCoverageMaps(coverageMap, converted)

        merged = { result: [] }
      },
      onDebug: debug,
    })

    // Include untested files when all tests were run (not a single file re-run)
    // or if previous results are preserved by "cleanOnRerun: false"
    if (this.options.include != null && (allTestsRun || !this.options.cleanOnRerun)) {
      const coveredFiles = coverageMap.files()
      const untestedCoverage = await this.getCoverageMapForUncoveredFiles(coveredFiles)

      smartMergeCoverageMaps(coverageMap, untestedCoverage)
    }

    coverageMap.filter((filename) => {
      const exists = existsSync(filename)

      if (this.options.excludeAfterRemap) {
        return exists && this.isIncluded(filename)
      }

      return exists
    })

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

        // Do not use pathToFileURL to avoid encoding filename parts
        const url = `file://${filename[0] === '/' ? '' : '/'}${filename}`

        const sources = await this.getSources(
          url,
          transform,
        )

        coverageMap.merge(await this.remapCoverage(
          url,
          0,
          sources,
          [],
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

  private async remapCoverage(filename: string, wrapperLength: number, result: Awaited<ReturnType<typeof this.getSources>>, functions: Profiler.FunctionCoverage[]) {
    let ast

    try {
      ast = await parseAstAsync(result.code)
    }
    catch (error) {
      this.ctx.logger.error(`Failed to parse ${filename}. Excluding it from coverage.\n`, error)
      return {}
    }

    return await astV8ToIstanbul({
      code: result.code,
      sourceMap: result.map,
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

        // CJS imports as ternaries - e.g.
        // const React = __vite__cjsImport0_react.__esModule ? __vite__cjsImport0_react.default : __vite__cjsImport0_react;
        if (
          type === 'branch'
          && node.type === 'ConditionalExpression'
          && node.test.type === 'MemberExpression'
          && node.test.object.type === 'Identifier'
          && node.test.object.name.startsWith('__vite__cjsImport')
          && node.test.property.type === 'Identifier'
          && node.test.property.name === '__esModule'
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

        // SSR mode's "import.meta.env ="
        if (
          type === 'statement'
          && node.type === 'ExpressionStatement'
          && node.expression.type === 'AssignmentExpression'
          && node.expression.left.type === 'MemberExpression'
          && node.expression.left.object.type === 'Identifier'
          && node.expression.left.object.name === '__vite_ssr_import_meta__') {
          return true
        }

        // SWC's decorators
        if (
          type === 'statement'
          && node.type === 'ExpressionStatement'
          && node.expression.type === 'CallExpression'
          && node.expression.callee.type === 'Identifier'
          && node.expression.callee.name === '_ts_decorate') {
          return 'ignore-this-and-nested-nodes'
        }
      },
    },
    )
  }

  private async getSources(
    url: string,
    onTransform: (filepath: string) => Promise<Vite.TransformResult | undefined | null>,
    functions: Profiler.FunctionCoverage[] = [],
  ): Promise<{
    code: string
    map?: Vite.Rollup.SourceMap
  }> {
    const transformResult = await onTransform(removeStartsWith(url, FILE_PROTOCOL)).catch(() => undefined)

    const map = transformResult?.map as Vite.Rollup.SourceMap | undefined
    const code = transformResult?.code

    if (code == null) {
      const filePath = normalize(fileURLToPath(url))

      const original = await fs.readFile(filePath, 'utf-8').catch(() => {
        // If file does not exist construct a dummy source for it.
        // These can be files that were generated dynamically during the test run and were removed after it.
        const length = findLongestFunctionLength(functions)
        return '/'.repeat(length)
      })

      return { code: original }
    }

    // Vue needs special handling for "map.sources"
    if (map) {
      map.sources ||= []

      map.sources = map.sources
        .filter(source => source != null)
        .map(source => new URL(source, url).href)

      if (map.sources.length === 0) {
        map.sources.push(url)
      }
    }

    return { code, map }
  }

  private async convertCoverage(
    coverage: RawCoverage,
    project: TestProject = this.ctx.getRootProject(),
    environment: string,
  ): Promise<CoverageMap> {
    if (environment === '__browser__' && !project.browser) {
      throw new Error(`Cannot access browser module graph because it was torn down.`)
    }

    async function onTransform(filepath: string) {
      if (environment === '__browser__' && project.browser) {
        const result = await project.browser.vite.transformRequest(removeStartsWith(filepath, project.config.root))

        if (result) {
          return { ...result, code: `${result.code}// <inline-source-map>` }
        }
      }
      return project.vite.environments[environment].transformRequest(filepath)
    }

    const scriptCoverages = []

    for (const result of coverage.result) {
      if (environment === '__browser__') {
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
        scriptCoverages.push({ ...result, url: decodeURIComponent(result.url) })
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
            onTransform,
            functions,
          )

          coverageMap.merge(await this.remapCoverage(
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

function removeStartsWith(filepath: string, start: string) {
  if (filepath.startsWith(start)) {
    return filepath.slice(start.length)
  }

  return filepath
}
