import { existsSync, promises as fs } from 'fs'
import { createRequire } from 'module'
import { resolve } from 'pathe'
import type { ExistingRawSourceMap, TransformPluginContext } from 'rollup'

import { configDefaults, defaultExclude, defaultInclude } from '../../defaults'
import type { Vitest } from '../../node'
import type { IstanbulOptions, ResolvedCoverageOptions } from '../../types'
import type { BaseCoverageProvider } from './base'

const require = createRequire(import.meta.url)
const coverageVariable = '__VITEST_COVERAGE__'

interface Instrumenter {
  /* Instrument the supplied code and track coverage against the supplied filename. It throws if invalid code is passed to it. ES5 and ES6 syntax is supported. To instrument ES6 modules, make sure that you set the esModules property to true when creating the instrumenter. */
  instrumentSync(
    /* The code to instrument */
    code: string,
    /* The filename against which to track coverage. */
    filename: string,
    /* The source map that maps the not instrumented code back to it's original form. Is assigned to the coverage object and therefore, is available in the json output and can be used to remap the coverage to the untranspiled source.): string; */
    inputSourceMap: object
  ): string

  /* Returns the file coverage object for the last file instrumented. */
  lastSourceMap(): ExistingRawSourceMap
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

export class IstanbulCoverageProvider implements BaseCoverageProvider {
  ctx!: Vitest
  options!: ResolvedCoverageOptions & { provider: 'istanbul' }
  instrumenter!: Instrumenter
  testExclude!: InstanceType<TestExclude>
  coverages: any[] = []

  initialize(ctx: Vitest) {
    this.ctx = ctx
    this.options = resolveIstanbulOptions(ctx.config.coverage, ctx.config.root)

    const { createInstrumenter } = require('istanbul-lib-instrument')
    this.instrumenter = createInstrumenter(this.options)

    const TestExclude = require('test-exclude')

    this.testExclude = new TestExclude({
      cwd: ctx.config.root,
      // TODO: Should we add a custom `coverage.exclude` to IstanbulOptions? It could be passed here.
      exclude: [...defaultExclude, ...defaultInclude],
      extension: ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte'],
      excludeNodeModules: true,
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
    // TODO: Some implementations write these into file system instead of storing in memory.
    // Then when merging the results, JSONs are read & deleted from fs and convert into coverageMap
    this.coverages.push(coverage)
  }

  async clean(clean = true) {
    if (clean && existsSync(this.options.reportsDirectory))
      await fs.rm(this.options.reportsDirectory, { recursive: true, force: true })

    this.coverages = []
  }

  async onAfterAllFilesRun() {
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
    const coverageMap = await sourceMapStore.transformCoverage(mergedCoverage)

    const context = libReport.createContext({
      dir: this.options.reportsDirectory,
      coverageMap,
      sourceFinder: sourceMapStore.sourceFinder,
    })

    for (const reporter of this.options.reporter)
      reports.create(reporter).execute(context)
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

    provider: 'istanbul',

    // Defaults from nyc, https://github.com/istanbuljs/nyc/blob/master/lib/instrumenters/istanbul.js#L7
    preserveComments: true,
    produceSourceMap: true,
    autoWrap: true,
    esModules: true,

    // Overrides
    ...options,

    // Options of nyc which should not be overriden
    coverageVariable,
    coverageGlobalScope: 'globalThis',
    coverageGlobalScopeFunc: false,

    reportsDirectory,
    tempDirectory: resolve(reportsDirectory, 'tmp'),
  }

  return resolved as ResolvedCoverageOptions & { provider: 'istanbul' }
}
