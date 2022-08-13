import { existsSync, promises as fs } from 'fs'
import { createRequire } from 'module'
import _url from 'url'
import type { Profiler } from 'inspector'
import { resolve } from 'pathe'
import type { RawSourceMap } from 'vite-node'

import { toArray } from '../../utils'
import { configDefaults } from '../../defaults'
import type { C8Options, ResolvedCoverageOptions } from '../../types'
import type { Vitest } from '../../node'
import type { CoverageProvider } from './base'

const require = createRequire(import.meta.url)

export class C8CoverageProvider implements CoverageProvider {
  name = 'c8'

  ctx!: Vitest
  options!: ResolvedCoverageOptions & { provider: 'c8' }

  initialize(ctx: Vitest) {
    this.ctx = ctx
    this.options = resolveC8Options(ctx.config.coverage, ctx.config.root)
  }

  resolveOptions() {
    return this.options
  }

  onBeforeFilesRun() {
    process.env.NODE_V8_COVERAGE ||= this.options.tempDirectory
  }

  async clean(clean = true) {
    if (clean && existsSync(this.options.reportsDirectory))
      await fs.rm(this.options.reportsDirectory, { recursive: true, force: true })

    if (!existsSync(this.options.tempDirectory))
      await fs.mkdir(this.options.tempDirectory, { recursive: true })
  }

  onAfterSuiteRun() {
    C8CoverageProvider.getCoverage()
  }

  async reportCoverage() {
    C8CoverageProvider.getCoverage()

    const createReport = require('c8/lib/report')
    const report = createReport(this.ctx.config.coverage)

    // add source maps
    const sourceMapMeta: Record<string, { map: RawSourceMap; source: string | undefined }> = {}
    await Promise.all(Array
      .from(this.ctx.vitenode.fetchCache.entries())
      .filter(i => !i[0].includes('/node_modules/'))
      .map(async ([file, { result }]) => {
        const map = result.map
        if (!map)
          return

        const url = _url.pathToFileURL(file).href

        let code: string | undefined
        try {
          code = (await fs.readFile(file)).toString()
        }
        catch {}

        // Vite does not report full path in sourcemap sources
        // so use an actual file path
        const sources = [url]

        sourceMapMeta[url] = {
          source: result.code,
          map: {
            sourcesContent: code ? [code] : undefined,
            ...map,
            sources,
          },
        }
      }))

    // This is a magic number. It corresponds to the amount of code
    // that we add in packages/vite-node/src/client.ts:114 (vm.runInThisContext)
    // TODO: Include our transformations in sourcemaps
    const offset = 224

    report._getSourceMap = (coverage: Profiler.ScriptCoverage) => {
      const path = _url.pathToFileURL(coverage.url).href
      const data = sourceMapMeta[path]

      if (!data)
        return {}

      return {
        sourceMap: {
          sourcemap: data.map,
        },
        source: Array(offset).fill('.').join('') + data.source,
      }
    }

    await report.run()

    const { checkCoverages } = require('c8/lib/commands/check-coverage')
    await checkCoverages(this.options, report)
  }

  // Flush coverage to disk
  static getCoverage() {
    const v8 = require('v8')
    if (v8.takeCoverage == null)
      console.warn('[Vitest] takeCoverage is not available in this NodeJs version.\nCoverage could be incomplete. Update to NodeJs 14.18.')
    else
      v8.takeCoverage()
  }
}

function resolveC8Options(options: C8Options, root: string) {
  const resolved = {
    ...configDefaults.coverage,
    ...options as any,
  }

  if (options['100']) {
    resolved.lines = 100
    resolved.functions = 100
    resolved.branches = 100
    resolved.statements = 100
  }

  resolved.reporter = toArray(resolved.reporter)
  resolved.reportsDirectory = resolve(root, resolved.reportsDirectory)
  resolved.tempDirectory = process.env.NODE_V8_COVERAGE || resolve(resolved.reportsDirectory, 'tmp')

  return resolved
}
