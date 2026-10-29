import type { CoverageMap, FileCoverageData } from '@vitest/istanbul-lib-coverage'
import type { InputSourceMap, Instrumenter } from '@vitest/istanbul-lib-instrument'
import type { ProxifiedModule } from 'magicast'
import type { CoverageProvider, ReportContext, TestProject, Vite, Vitest } from 'vitest/node'
import { existsSync, promises as fs } from 'node:fs'
import * as libCoverage from '@vitest/istanbul-lib-coverage'
import { createInstrumenter } from '@vitest/istanbul-lib-instrument'
import * as libReport from '@vitest/istanbul-lib-report'
import * as libSourceMaps from '@vitest/istanbul-lib-source-maps'
import { parseModule } from 'magicast'
import { createDebug } from 'obug'
import { normalize } from 'pathe'
import c from 'tinyrainbow'
import { BaseCoverageProvider, isCSSRequest } from 'vitest/node'
import { version } from '../package.json' with { type: 'json' }
import { commands } from './commands'
import { COVERAGE_STORE_KEY } from './constants'

const debug = createDebug('vitest:coverage')

export class IstanbulCoverageProvider extends BaseCoverageProvider implements CoverageProvider {
  name = 'istanbul' as const
  version: string = version
  instrumenter!: Instrumenter

  private transformedModuleIds = new Set<string>()
  private inputSourceMaps = new WeakMap<Vite.Environment, Map<string, InputSourceMap>>()
  private uncoveredFileCoverages = new Map<
    string,
    { coverage: FileCoverageData; inputSourceMap: InputSourceMap }
  >()

  initialize(ctx: Vitest): void {
    this._initialize(ctx)

    for (const project of ctx.projects) {
      if (project.isBrowserEnabled() && project.browser) {
        for (const [name, command] of Object.entries(commands)) {
          project.browser.registerCommand(`__vitest_${name}` as any, command)
        }
      }
    }

    if (this.options.instrumenter) {
      this.instrumenter = this.options.instrumenter({
        coverageVariable: COVERAGE_STORE_KEY,
        coverageGlobalScope: 'globalThis',
        coverageGlobalScopeFunc: false,
        ignoreClassMethods: this.options.ignoreClassMethods,
      }) as Instrumenter
    } else {
      this.instrumenter = createInstrumenter({
        produceSourceMap: true,
        autoWrap: false,
        esModules: true,
        compact: false,
        coverageVariable: COVERAGE_STORE_KEY,
        coverageGlobalScope: 'globalThis',
        coverageGlobalScopeFunc: false,
        ignoreClassMethods: this.options.ignoreClassMethods,
        ignoreLines: true,
        combineSourceMaps: false,
        inputSourceMap: false,
      })
    }
  }

  requiresTransform(id: string): boolean {
    // Istanbul cannot instrument CSS - e.g. Vue imports end up here.
    // File extension itself is .vue, but it contains CSS.
    // e.g. "Example.vue?vue&type=style&index=0&scoped=f7f04e08&lang.css"
    if (isCSSRequest(id)) {
      return false
    }

    if (!this.isIncluded(removeQueryParameters(id))) {
      return false
    }

    return true
  }

  async clean(clean = true): Promise<void> {
    await super.clean(clean)
    this.uncoveredFileCoverages.clear()
  }

  onFileTransform(
    sourceCode: string,
    id: string,
    pluginCtx: Vite.Rollup.TransformPluginContext,
  ): { code: string; map: any } | undefined {
    if (!this.requiresTransform(id)) {
      return
    }

    const sourceMap = pluginCtx.getCombinedSourcemap()
    sourceMap.sources = sourceMap.sources.map(removeQueryParameters)

    sourceCode = sourceCode
      // Exclude SWC's decorators that are left in source maps
      .replaceAll('_ts_decorate', '/* istanbul ignore next */_ts_decorate')

      // Exclude in-source test's test cases
      .replaceAll(/(if +\(import\.meta\.vitest\))/g, '/* istanbul ignore next */ $1')

    const code = this.instrumenter.instrumentSync(sourceCode, id, sourceMap as any)
    const uncoveredKey = getUncoveredKey(id)

    if (uncoveredKey) {
      this.uncoveredFileCoverages.set(uncoveredKey, {
        coverage: this.instrumenter.lastFileCoverage(),
        inputSourceMap: sourceMap as InputSourceMap,
      })
    } else {
      this.setInputSourceMap(pluginCtx.environment, id, sourceMap as InputSourceMap)
    }

    const map = this.instrumenter.lastSourceMap() as any
    this.transformedModuleIds.add(id)

    return { code, map }
  }

  getModuleCacheData(environment: Vite.Environment, id: string): InputSourceMap | undefined {
    return this.inputSourceMaps.get(environment)?.get(id)
  }

  // Modules loaded from fsModuleCache are not passed to onFileTransform
  restoreModuleCacheData(environment: Vite.Environment, id: string, data: unknown): void {
    this.setInputSourceMap(environment, id, data as InputSourceMap)
    this.transformedModuleIds.add(id)
  }

  private setInputSourceMap(environment: Vite.Environment, id: string, map: InputSourceMap) {
    let inputSourceMaps = this.inputSourceMaps.get(environment)

    if (!inputSourceMaps) {
      inputSourceMaps = new Map()
      this.inputSourceMaps.set(environment, inputSourceMaps)
    }

    inputSourceMaps.set(id, map)
  }

  createCoverageMap(): libCoverage.CoverageMap {
    return libCoverage.createCoverageMap({})
  }

  async generateCoverage({ allTestsRun }: ReportContext): Promise<CoverageMap> {
    const start = debug.enabled ? performance.now() : 0

    const coverageMap = this.createCoverageMap()
    let coverageMapByEnvironment = this.createCoverageMap()

    await this.readCoverageFiles<CoverageMap>({
      onFileRead(coverage) {
        coverageMapByEnvironment.merge(coverage)
      },
      onFinished: async (project, environment) => {
        // Source maps can change based on projectName and transform mode.
        // Coverage transform re-uses source maps so we need to separate transforms from each other.
        const transformedCoverage = await transformCoverage(
          coverageMapByEnvironment,
          this.getInputSourceMaps(project, environment),
        )
        coverageMap.merge(transformedCoverage)

        coverageMapByEnvironment = this.createCoverageMap()
      },
      onDebug: debug,
    })

    // Include untested files when all tests were run (not a single file re-run)
    // or if previous results are preserved by "cleanOnRerun: false"
    if (this.options.include != null && (allTestsRun || !this.options.cleanOnRerun)) {
      const coveredFiles = coverageMap.files()
      const uncovered = await this.getCoverageMapForUncoveredFiles(coveredFiles)

      coverageMap.merge(await transformCoverage(uncovered.coverageMap, uncovered.inputSourceMaps))
    }

    coverageMap.filter((filename) => {
      const exists = existsSync(filename)

      // files can be instrumented before the changed files are resolved
      if (this.changedFiles && !this.changedFiles.includes(normalize(filename))) {
        return false
      }

      if (this.options.excludeAfterRemap) {
        return exists && this.isIncluded(filename)
      }

      return exists
    })

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
      this.ctx.logger.log(c.blue(' % ') + c.dim('Coverage report from ') + c.yellow(this.name))
    }

    for (const reporter of this.options.reporter) {
      // Type assertion required for custom reporters
      const reportInstance = await libReport.createAsync(
        reporter[0] as Parameters<typeof libReport.create>[0],
        {
          skipFull: this.options.skipFull,
          projectRoot: this.ctx.config.root,
          ...reporter[1],
        },
      )

      reportInstance.execute(context)
    }

    if (this.options.thresholds) {
      await this.reportThresholds(coverageMap, allTestsRun)
    }
  }

  async parseConfigModule(configFilePath: string): Promise<ProxifiedModule<any>> {
    const contents = await fs.readFile(configFilePath, 'utf8')

    return parseModule(`${contents}${this.autoUpdateMarker}`)
  }

  private async getCoverageMapForUncoveredFiles(coveredFiles: string[]) {
    const uncoveredFiles = await this.getUntestedFiles(coveredFiles)

    const cacheKey = Date.now()
    const coverageMap = this.createCoverageMap()
    const inputSourceMaps = new Map<string, InputSourceMap>()

    const transform = this.createUncoveredFileTransformer(this.ctx)

    let processed = 0

    for (const chunk of this.toSlices(uncoveredFiles, this.options.processingConcurrency)) {
      if (debug.enabled) {
        processed += chunk.length
        debug('Uncovered files %d/%d', processed, uncoveredFiles.length)
      }

      await Promise.all(
        chunk.map(async (filename, index) => {
          let timeout: ReturnType<typeof setTimeout> | undefined
          let start: number | undefined

          if (debug.enabled) {
            start = performance.now()
            timeout = setTimeout(
              () => debug(c.bgRed(`File "${filename}" is taking longer than 3s`)),
              3_000,
            )
          }

          // Unique key makes sure file is not served from cache
          const uncoveredKey = `${cacheKey}-${index}`
          await transform(`${filename}?cache=${uncoveredKey}&vitest-uncovered-coverage=true`)

          const fileCoverage = this.uncoveredFileCoverages.get(uncoveredKey)
          this.uncoveredFileCoverages.delete(uncoveredKey)

          if (fileCoverage) {
            coverageMap.addFileCoverage(fileCoverage.coverage)
            inputSourceMaps.set(fileCoverage.coverage.path, fileCoverage.inputSourceMap)
          }

          if (debug.enabled) {
            clearTimeout(timeout)

            const diff = performance.now() - start!
            const color = diff > 500 ? c.bgRed : c.bgGreen
            debug(`${color(` ${diff.toFixed()} ms `)} ${filename}`)
          }
        }),
      )
    }

    return { coverageMap, inputSourceMaps }
  }

  private getInputSourceMaps(project: TestProject, environment: string) {
    const viteEnvironment =
      project.isBrowserEnabled() && environment === 'client'
        ? project.browser?.vite.environments.client
        : project.vite.environments[environment]

    return viteEnvironment ? this.inputSourceMaps.get(viteEnvironment) : undefined
  }

  // the coverage can be enabled after the tests are run
  // this means the coverage will not be injected because the modules are cached,
  // so we are invalidating all modules that don't have the istanbul coverage injected
  onEnabled(): void {
    const environments = this.ctx.projects.flatMap((project) => [
      ...Object.values(project.vite.environments),
      ...Object.values(project.browser?.vite.environments || {}),
    ])

    const seen = new Set<Vite.EnvironmentModuleNode>()
    environments.forEach((environment) => {
      environment.moduleGraph.idToModuleMap.forEach((node) => {
        this.invalidateTree(node, environment.moduleGraph, seen)
      })
    })
  }

  private invalidateTree(
    node: Vite.EnvironmentModuleNode,
    moduleGraph: Vite.EnvironmentModuleGraph,
    seen: Set<Vite.EnvironmentModuleNode>,
  ) {
    if (seen.has(node)) {
      return
    }
    if (node.id && !this.transformedModuleIds.has(node.id)) {
      moduleGraph.invalidateModule(node, seen)
    }
    seen.add(node) // to avoid infinite loops in circular dependencies
    node.importedModules.forEach((mod) => {
      this.invalidateTree(mod, moduleGraph, seen)
    })
  }
}

async function transformCoverage(
  coverageMap: CoverageMap,
  inputSourceMaps?: Map<string, InputSourceMap>,
) {
  const sourceMapStore = libSourceMaps.createSourceMapStore()

  if (inputSourceMaps) {
    for (const filename of coverageMap.files()) {
      const inputSourceMap = inputSourceMaps.get(filename)

      if (inputSourceMap) {
        sourceMapStore.registerMap(filename, inputSourceMap)
      }
    }
  }

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

function getUncoveredKey(id: string) {
  if (!id.includes('vitest-uncovered-coverage=true')) {
    return
  }

  return new URLSearchParams(id.split('?')[1]).get('cache') ?? undefined
}
