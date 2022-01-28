import { existsSync, promises as fs } from 'fs'
import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import { resolve } from 'pathe'
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

  return resolved as ResolvedC8Options
}

export async function cleanCoverage(options: ResolvedC8Options, clean = true) {
  if (clean && existsSync(options.reportsDirectory))
    await fs.rm(options.reportsDirectory, { recursive: true, force: true })
}

const require = createRequire(import.meta.url)

export async function reportCoverage(ctx: Vitest) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const createReport = require('c8/lib/report')
  const report = createReport(ctx.config.coverage)

  report._loadReports = () => ctx.coverage

  const original = report._getMergedProcessCov

  report._getMergedProcessCov = () => {
    const r = original.call(report)

    // add source maps
    Array
      .from(ctx.vitenode.fetchCache.entries())
      .filter(i => !i[0].includes('/node_modules/'))
      .forEach(([file, { result }]) => {
        const map = result.map
        if (!map)
          return
        const url = pathToFileURL(file).href
        const sources = map.sources.length
          ? map.sources.map(i => pathToFileURL(i).href)
          : [url]
        report.sourceMapCache[url] = {
          data: { ...map, sources },
        }
      })

    return r
  }

  await report.run()
}
