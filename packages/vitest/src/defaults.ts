import type {
  BenchmarkUserOptions,
  CoverageV8Options,
  ResolvedCoverageOptions,
  UserConfig,
} from './node/types/config'
import os from 'node:os'
import { isCI } from './utils/env'

export { defaultBrowserPort } from './constants'

export const defaultInclude: string[] = ['**/*.{test,spec}.?(c|m)[jt]s?(x)']
export const defaultExclude: string[] = [
  '**/node_modules/**',
  '**/dist/**',
  '**/cypress/**',
  '**/.{idea,git,cache,output,temp}/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
]
export const benchmarkConfigDefaults: Required<
  Omit<BenchmarkUserOptions, 'outputFile' | 'compare' | 'outputJson'>
> = {
  include: ['**/*.{bench,benchmark}.?(c|m)[jt]s?(x)'],
  exclude: defaultExclude,
  includeSource: [],
  reporters: ['default'],
  includeSamples: false,
}

const defaultCoverageExcludes = [
  'coverage/**',
  'dist/**',
  '**/node_modules/**',
  '**/[.]**',
  'packages/*/test?(s)/**',
  '**/*.d.ts',
  '**/virtual:*',
  '**/__x00__*',
  '**/\x00*',
  'cypress/**',
  'test?(s)/**',
  'test?(-*).?(c|m)[jt]s?(x)',
  '**/*{.,-}{test,spec,bench,benchmark}?(-d).?(c|m)[jt]s?(x)',
  '**/__tests__/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
  '**/vitest.{workspace,projects}.[jt]s?(on)',
  '**/.{eslint,mocha,prettier}rc.{?(c|m)js,yml}',
]

// These are the generic defaults for coverage. Providers may also set some provider specific defaults.
export const coverageConfigDefaults: ResolvedCoverageOptions = {
  provider: 'v8',
  enabled: false,
  all: true,
  clean: true,
  cleanOnRerun: true,
  reportsDirectory: './coverage',
  exclude: defaultCoverageExcludes,
  reportOnFailure: false,
  reporter: [
    ['text', {}],
    ['html', {}],
    ['clover', {}],
    ['json', {}],
  ],
  extension: [
    '.js',
    '.cjs',
    '.mjs',
    '.ts',
    '.mts',
    '.tsx',
    '.jsx',
    '.vue',
    '.svelte',
    '.marko',
    '.astro',
  ],
  allowExternal: false,
  excludeAfterRemap: false,
  ignoreEmptyLines: true,
  processingConcurrency: Math.min(
    20,
    os.availableParallelism?.() ?? os.cpus().length,
  ),
}

export const fakeTimersDefaults: NonNullable<UserConfig['fakeTimers']> = {
  loopLimit: 10_000,
  shouldClearNativeTimers: true,
}

export const configDefaults: Readonly<{
  allowOnly: boolean
  isolate: boolean
  watch: boolean
  globals: boolean
  environment: 'node'
  pool: 'forks'
  clearMocks: boolean
  restoreMocks: boolean
  mockReset: boolean
  unstubGlobals: boolean
  unstubEnvs: boolean
  include: string[]
  exclude: string[]
  teardownTimeout: number
  forceRerunTriggers: string[]
  update: boolean
  reporters: never[]
  silent: boolean
  hideSkippedTests: boolean
  api: boolean
  ui: boolean
  uiBase: string
  open: boolean
  css: {
    include: never[]
  }
  coverage: CoverageV8Options
  fakeTimers: import('@sinonjs/fake-timers').FakeTimerInstallOpts
  maxConcurrency: number
  dangerouslyIgnoreUnhandledErrors: boolean
  typecheck: {
    checker: 'tsc'
    include: string[]
    exclude: string[]
  }
  slowTestThreshold: number
  disableConsoleIntercept: boolean
}> = Object.freeze({
  allowOnly: !isCI,
  isolate: true,
  watch: !isCI,
  globals: false,
  environment: 'node' as const,
  pool: 'forks' as const,
  clearMocks: false,
  restoreMocks: false,
  mockReset: false,
  unstubGlobals: false,
  unstubEnvs: false,
  include: defaultInclude,
  exclude: defaultExclude,
  teardownTimeout: 10000,
  forceRerunTriggers: ['**/package.json/**', '**/{vitest,vite}.config.*/**'],
  update: false,
  reporters: [],
  silent: false,
  hideSkippedTests: false,
  api: false,
  ui: false,
  uiBase: '/__vitest__/',
  open: !isCI,
  css: {
    include: [],
  },
  coverage: coverageConfigDefaults as CoverageV8Options,
  fakeTimers: fakeTimersDefaults,
  maxConcurrency: 5,
  dangerouslyIgnoreUnhandledErrors: false,
  typecheck: {
    checker: 'tsc' as const,
    include: ['**/*.{test,spec}-d.?(c|m)[jt]s?(x)'],
    exclude: defaultExclude,
  },
  slowTestThreshold: 300,
  disableConsoleIntercept: false,
})
