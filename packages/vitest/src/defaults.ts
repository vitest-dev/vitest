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
  '**/.git/**',
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

// These are the generic defaults for coverage. Providers may also set some provider specific defaults.
export const coverageConfigDefaults: ResolvedCoverageOptions = {
  provider: 'v8',
  enabled: false,
  clean: true,
  cleanOnRerun: true,
  reportsDirectory: './coverage',
  exclude: [],
  reportOnFailure: false,
  reporter: [
    ['text', {}],
    ['html', {}],
    ['clover', {}],
    ['json', {}],
  ],
  allowExternal: false,
  excludeAfterRemap: false,
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
  watch: !isCI && process.stdin.isTTY,
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
