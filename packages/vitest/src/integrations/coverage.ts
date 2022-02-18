import { existsSync, promises as fs } from 'fs'
import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import type { Profiler } from 'inspector'
import { resolve } from 'pathe'
import type { RawSourceMap } from 'vite-node'
import type { Vitest } from '../node'
import { toArray } from '../utils'
import type { C8Options, ResolvedC8Options } from '../types'
import { configDefaults } from '../defaults'

export function resolveC8Options(options: C8Options, root: string): ResolvedC8Options {
  const resolved: ResolvedC8Options = {
    ...configDefaults.coverage,
    ...options as any,
  }

  resolved.reporter = toArray(resolved.reporter)
  resolved.reportsDirectory = resolve(root, resolved.reportsDirectory)
  resolved.tempDirectory = process.env.NODE_V8_COVERAGE || resolve(resolved.reportsDirectory, 'tmp')

  return resolved as ResolvedC8Options
}

export async function cleanCoverage(options: ResolvedC8Options, clean = true) {
  if (clean && existsSync(options.reportsDirectory))
    await fs.rm(options.reportsDirectory, { recursive: true, force: true })

  if (!existsSync(options.tempDirectory))
    await fs.mkdir(options.tempDirectory, { recursive: true })
}

const require = createRequire(import.meta.url)

// Flush coverage to disk
export function takeCoverage() {
  const v8 = require('v8')
  if (v8.takeCoverage == null)
    console.warn('[Vitest] takeCoverage is not available in this NodeJs version.\nCoverage could be incomplete. Update to NodeJs 14.18.')
  else
    v8.takeCoverage()
}

export async function reportCoverage(ctx: Vitest) {
  takeCoverage()

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const createReport = require('c8/lib/report')
  const report = createReport(ctx.config.coverage)

  // add source maps
  const sourceMapMeta: Record<string, { map: RawSourceMap; source: string | undefined }> = {}
  await Promise.all(Array
    .from(ctx.vitenode.fetchCache.entries())
    .filter(i => !i[0].includes('/node_modules/'))
    .map(async([file, { result }]) => {
      const map = result.map
      if (!map)
        return

      const url = pathToFileURL(file).href

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
  // TODO: Include our transformations in soucemaps
  const offset = 190

  report._getSourceMap = (coverage: Profiler.ScriptCoverage) => {
    const path = pathToFileURL(coverage.url).href
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

  if (ctx.config.coverage.enabled) {
    if (ctx.config.coverage['100']) {
      ctx.config.coverage.lines = 100
      ctx.config.coverage.functions = 100
      ctx.config.coverage.branches = 100
      ctx.config.coverage.statements = 100
    }

    const { checkCoverages } = require('c8/lib/commands/check-coverage')
    await checkCoverages(ctx.config.coverage, report)
  }
}
