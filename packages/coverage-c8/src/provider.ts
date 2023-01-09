import { existsSync, promises as fs } from 'fs'
import _url from 'url'
import type { Profiler } from 'inspector'
import { takeCoverage } from 'v8'
import { extname, resolve } from 'pathe'
import type { RawSourceMap } from 'vite-node'
import { configDefaults } from 'vitest/config'
// eslint-disable-next-line no-restricted-imports
import type { CoverageC8Options, CoverageProvider, ResolvedCoverageOptions } from 'vitest'
import type { Vitest } from 'vitest/node'
// @ts-expect-error missing types
import createReport from 'c8/lib/report.js'
// @ts-expect-error missing types
import { checkCoverages } from 'c8/lib/commands/check-coverage.js'

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
      await fs.rm(this.options.reportsDirectory, { recursive: true, force: true, maxRetries: 10 })

    if (!existsSync(this.options.tempDirectory))
      await fs.mkdir(this.options.tempDirectory, { recursive: true })
  }

  onAfterSuiteRun() {
    takeCoverage()
  }

  async reportCoverage() {
    takeCoverage()
    const report = createReport(this.ctx.config.coverage)

    interface MapAndSource { map: RawSourceMap; source: string | undefined }
    type SourceMapMeta = { url: string; filepath: string } & MapAndSource

    // add source maps
    const sourceMapMeta: Record<SourceMapMeta['url'], MapAndSource> = {}
    const extensions = Array.isArray(this.options.extension) ? this.options.extension : [this.options.extension]

    const entries = Array
      .from(this.ctx.vitenode.fetchCache.entries())
      .filter(i => !i[0].includes('/node_modules/'))
      .map(([file, { result }]) => {
        if (!result.map)
          return null

        const filepath = file.split('?')[0]
        const url = _url.pathToFileURL(filepath).href
        const extension = extname(file) || extname(url)

        return {
          filepath,
          url,
          extension,
          map: result.map,
          source: result.code,
        }
      })
      .filter((entry) => {
        if (!entry)
          return false

        if (!extensions.includes(entry.extension))
          return false

        // Mappings and sourcesContent are needed for C8 to work
        return (
          entry.map.mappings.length > 0
          && entry.map.sourcesContent
          && entry.map.sourcesContent.length > 0
          && entry.map.sourcesContent[0].length > 0
        )
      }) as SourceMapMeta[]

    await Promise.all(entries.map(async ({ url, source, map, filepath }) => {
      if (url in sourceMapMeta)
        return

      let code: string | undefined
      try {
        code = (await fs.readFile(filepath)).toString()
      }
      catch { }

      // Vite does not report full path in sourcemap sources
      // so use an actual file path
      const sources = [url]

      sourceMapMeta[url] = {
        source,
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
    const offset = 203

    report._getSourceMap = (coverage: Profiler.ScriptCoverage) => {
      const path = _url.pathToFileURL(coverage.url.split('?')[0]).href
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
    await checkCoverages(this.options, report)

    // Note that this will only clean up the V8 reports generated so far.
    // There will still be a temp directory with some reports when vitest exists,
    // but at least it will only contain reports of vitest's internal functions.
    if (existsSync(this.options.tempDirectory))
      await fs.rm(this.options.tempDirectory, { recursive: true, force: true, maxRetries: 10 })
  }
}
function resolveC8Options(options: CoverageC8Options, root: string) {
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

  resolved.reporter = resolved.reporter || []
  resolved.reporter = Array.isArray(resolved.reporter) ? resolved.reporter : [resolved.reporter]
  resolved.reportsDirectory = resolve(root, resolved.reportsDirectory)
  resolved.tempDirectory = process.env.NODE_V8_COVERAGE || resolve(resolved.reportsDirectory, 'tmp')

  return resolved
}
