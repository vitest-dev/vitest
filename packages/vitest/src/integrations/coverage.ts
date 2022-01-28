import { existsSync, promises as fs } from 'fs'
import { takeCoverage } from 'v8'
import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import type { Profiler } from 'inspector'
import { resolve } from 'pathe'
import type { RawSourceMap } from 'vite-node'
import type { Vitest } from '../node'
import { toArray } from '../utils'
import type { C8Options, ResolvedC8Options } from '../types'

const defaultExcludes = [
  'coverage/**',
  'packages/*/test{,s}/**',
  '**/*.d.ts',
  'test{,s}/**',
  'test{,-*}.{js,cjs,mjs,ts,tsx,jsx}',
  '**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx}',
  '**/__tests__/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc}.config.{js,cjs,mjs,ts}',
  '**/.{eslint,mocha}rc.{js,cjs}',
]

export function resolveC8Options(options: C8Options, root: string): ResolvedC8Options {
  const resolved: ResolvedC8Options = {
    enabled: false,
    clean: true,
    cleanOnRerun: false,
    reportsDirectory: './coverage',
    excludeNodeModules: true,
    exclude: defaultExcludes,
    reporter: ['text', 'html'],
    allowExternal: false,
    // default extensions used by c8, plus '.vue' and '.svelte'
    // see https://github.com/istanbuljs/schema/blob/master/default-extension.js
    extension: ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.vue', 'svelte'],
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

export async function reportCoverage(ctx: Vitest) {
  // Flush coverage to disk
  takeCoverage()

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const createReport = require('c8/lib/report')
  const report = createReport(ctx.config.coverage)

  // add source maps
  const sourceMapMata: Record<string, { map: RawSourceMap; source: string | undefined }> = {}
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

      const sources = map.sources.length
        ? map.sources.map(i => pathToFileURL(i).href)
        : [url]

      sourceMapMata[url] = {
        source: result.code,
        map: {
          sourcesContent: code ? [code] : undefined,
          ...map,
          sources,
        },
      }
    }))

  // This is a magic number it corresponds to the amount of code
  // that we add in packages/vite-node/src/client.ts:110 (vm.runInThisContext)
  // TODO: Include our transformations in soucemaps
  const offset = 190

  report._getSourceMap = (coverage: Profiler.ScriptCoverage) => {
    const path = pathToFileURL(coverage.url).href
    const data = sourceMapMata[path]

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
}
