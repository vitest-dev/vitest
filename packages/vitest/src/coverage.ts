import { existsSync, promises as fs } from 'fs'
import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import { resolve } from 'pathe'
import type { Arrayable } from './types'
import type { Vitest } from './node'
import { toArray } from './utils'

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

export type CoverageReporter =
  | 'clover'
  | 'cobertura'
  | 'html-spa'
  | 'html'
  | 'json-summary'
  | 'json'
  | 'lcov'
  | 'lcovonly'
  | 'none'
  | 'teamcity'
  | 'text-lcov'
  | 'text-summary'
  | 'text'

export interface C8Options {
  /**
   * Enable coverage, pass `--coverage` to enable
   *
   * @default false
   */
  enabled?: boolean
  /**
   * Directory to write coverage report to
   */
  reportsDirectory?: string
  /**
   * Clean coverage before running tests
   *
   * @default true
   */
  clean?: boolean
  /**
   * Clean coverage report on watch rerun
   *
   * @default false
   */
  cleanOnRerun?: boolean
  /**
   * Allow files from outside of your cwd.
   *
   * @default false
   */
  allowExternal?: any
  /**
   * Reporters
   *
   * @default 'text'
   */
  reporter?: Arrayable<CoverageReporter>
  /**
   * Exclude coverage under /node_modules/
   *
   * @default true
   */
  excludeNodeModules?: boolean
  exclude?: string[]
  include?: string[]
  skipFull?: boolean
  extension?: string | string[]

  // c8 options, not sure if we should expose them
  /**
   * Directory to store V8 coverage reports
   */
  // tempDirectory?: string
  // watermarks?: any
  // excludeAfterRemap?: any
  // omitRelative?: any
  // wrapperLength?: any
  // resolve?: any
  // all?: any
  // src?: any
}

export interface ResolvedC8Options extends Required<C8Options> {
  tempDirectory: string
}

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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const createReport = require('c8/lib/report')
  const report = createReport(ctx.config.coverage)

  const original = report._getMergedProcessCov

  report._getMergedProcessCov = () => {
    const r = original.call(report)

    // add source maps
    Array
      .from(ctx.visitedFilesMap.entries())
      .filter(i => !i[0].includes('/node_modules/'))
      .forEach(([file, map]) => {
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
