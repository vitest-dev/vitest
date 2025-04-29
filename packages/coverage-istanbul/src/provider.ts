import type { CoverageMap } from 'istanbul-lib-coverage'
import type { Instrumenter } from 'istanbul-lib-instrument'
import type { ProxifiedModule } from 'magicast'
import type { BaseCoverageOptions, CoverageProvider, ReportContext, ResolvedConfig, ResolvedCoverageOptions, Vitest } from 'vitest/node'
import { promises as fs } from 'node:fs'
// @ts-expect-error missing types
import { defaults as istanbulDefaults } from '@istanbuljs/schema'
import createDebug from 'debug'
import libCoverage from 'istanbul-lib-coverage'
import { createInstrumenter } from 'istanbul-lib-instrument'
import libReport from 'istanbul-lib-report'
import libSourceMaps from 'istanbul-lib-source-maps'
import reports from 'istanbul-reports'
import { parseModule } from 'magicast'
import { resolve } from 'pathe'
import TestExclude from 'test-exclude'
import c from 'tinyrainbow'
import { BaseCoverageProvider } from 'vitest/coverage'

import { version } from '../package.json' with { type: 'json' }
import { COVERAGE_STORE_KEY } from './constants'

const debug = createDebug('vitest:coverage')

export class IstanbulCoverageProvider extends BaseCoverageProvider<ResolvedCoverageOptions<'istanbul'>> implements CoverageProvider {
  name = 'istanbul' as const
  version: string = version
  instrumenter!: Instrumenter
  testExcludes!: Array<{ root: string; exclude: InstanceType<typeof TestExclude> }>

  initialize(ctx: Vitest): void {
    this._initialize(ctx)

    const roots = ctx.config.project.length
      ? ctx.projects.map(p => p.config.root)
      : [ctx.config.root]

    this.testExcludes = roots.map(root => ({
      root,
      exclude: new TestExclude({
        cwd: root,
        include: this.options.include,
        exclude: this.options.exclude,
        excludeNodeModules: true,
        extension: this.options.extension,
        relativePath: !this.options.allowExternal,
      }),
    }))

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
  }

  onFileTransform(sourceCode: string, id: string, pluginCtx: any): { code: string; map: any } | undefined {
    if (this.testExcludes.every(e => !e.exclude.shouldInstrument(id))) {
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

  createCoverageMap(): libCoverage.CoverageMap {
    return libCoverage.createCoverageMap({})
  }

  async generateCoverage({ allTestsRun }: ReportContext): Promise<CoverageMap> {
    const start = debug.enabled ? performance.now() : 0

    const coverageMap = this.createCoverageMap()
    let coverageMapByTransformMode = this.createCoverageMap()

    await this.readCoverageFiles<CoverageMap>({
      onFileRead(coverage) {
        coverageMapByTransformMode.merge(coverage)
      },
      onFinished: async () => {
        // Source maps can change based on projectName and transform mode.
        // Coverage transform re-uses source maps so we need to separate transforms from each other.
        const transformedCoverage = await transformCoverage(coverageMapByTransformMode)
        coverageMap.merge(transformedCoverage)

        coverageMapByTransformMode = this.createCoverageMap()
      },
      onDebug: debug,
    })

    // Include untested files when all tests were run (not a single file re-run)
    // or if previous results are preserved by "cleanOnRerun: false"
    if (this.options.all && (allTestsRun || !this.options.cleanOnRerun)) {
      const coveredFiles = coverageMap.files()
      const uncoveredCoverage = await this.getCoverageMapForUncoveredFiles(coveredFiles)

      coverageMap.merge(await transformCoverage(uncoveredCoverage))
    }

    if (this.options.excludeAfterRemap) {
      coverageMap.filter(filename =>
        this.testExcludes.some(e => e.exclude.shouldInstrument(filename)),
      )
    }

    if (debug.enabled) {
      debug('Generate coverage total time %d ms', (performance.now() - start!).toFixed())
    }

    return coverageMap
  }

  async generateReports(coverageMap: CoverageMap, allTestsRun: boolean | undefined): Promise<void> {
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

  private async resolveIncludedFiles(): Promise<string[]> {
    const matrix = await Promise.all(this.testExcludes.map(async (e) => {
      const files = await e.exclude.glob(e.root)
      return files.map(file => resolve(e.root, file))
    }))
    return matrix.flatMap(files => files)
  }

  private async getCoverageMapForUncoveredFiles(coveredFiles: string[]) {
    let includedFiles = await this.resolveIncludedFiles()

    if (this.ctx.config.changed) {
      includedFiles = (this.ctx.config.related || []).filter(file =>
        includedFiles.includes(file),
      )
    }

    const uncoveredFiles = includedFiles
      .filter(file => !coveredFiles.includes(file))
      .sort()

    const cacheKey = new Date().getTime()
    const coverageMap = this.createCoverageMap()

    const transform = this.createUncoveredFileTransformer(this.ctx)

    // Note that these cannot be run parallel as synchronous instrumenter.lastFileCoverage
    // returns the coverage of the last transformed file
    for (const [index, filename] of uncoveredFiles.entries()) {
      let timeout: ReturnType<typeof setTimeout> | undefined
      let start: number | undefined

      if (debug.enabled) {
        start = performance.now()
        timeout = setTimeout(() => debug(c.bgRed(`File "${filename}" is taking longer than 3s`)), 3_000)

        debug('Uncovered file %d/%d', index, uncoveredFiles.length)
      }

      // Make sure file is not served from cache so that instrumenter loads up requested file coverage
      await transform(`${filename}?v=${cacheKey}`)
      const lastCoverage = this.instrumenter.lastFileCoverage()
      coverageMap.addFileCoverage(lastCoverage)

      if (debug.enabled) {
        clearTimeout(timeout)

        const diff = performance.now() - start!
        const color = diff > 500 ? c.bgRed : c.bgGreen
        debug(`${color(` ${diff.toFixed()} ms `)} ${filename}`)
      }
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
