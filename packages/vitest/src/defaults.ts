import type {
  BenchmarkUserOptions,
  CoverageOptions,
  ReporterWithOptions,
  UserConfig,
} from './node/types/config'
import type { FieldsWithDefaultValues } from './node/types/coverage'
import os from 'node:os'
import { isAgent, isCI } from './utils/env'

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
export const coverageConfigDefaults: Required<Pick<CoverageOptions, FieldsWithDefaultValues>> = {
  provider: 'v8',
  enabled: false,
  clean: true,
  cleanOnRerun: true,
  reportsDirectory: './coverage',
  exclude: [],
  reportOnFailure: false,
  reporter: [
    'text',
    'html',
    'clover',
    'json',
  ],
  allowExternal: false,
  excludeAfterRemap: false,
  processingConcurrency: Math.min(
    20,
    os.availableParallelism?.() ?? os.cpus().length,
  ),
  ignoreClassMethods: [],
  skipFull: false,
  watermarks: {
    statements: [50, 80],
    functions: [50, 80],
    branches: [50, 80],
    lines: [50, 80],
  },
  autoAttachSubprocess: false,
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
  reporters: ReporterWithOptions[]
  silent: boolean
  hideSkippedTests: boolean
  api: boolean
  ui: boolean
  uiBase: string
  open: boolean
  css: {
    include: never[]
  }
  coverage: CoverageOptions
  fakeTimers: import('@sinonjs/fake-timers').FakeTimerInstallOpts
  maxConcurrency: number
  dangerouslyIgnoreUnhandledErrors: boolean
  typecheck: {
    checker: 'tsc'
    include: string[]
    exclude: string[]
  }
  slowTestThreshold: number
  taskTitleValueFormatTruncate: number
  disableConsoleIntercept: boolean
  detectAsyncLeaks: boolean
}> = Object.freeze({
  allowOnly: !isCI,
  isolate: true,
  watch: !isCI && process.stdin.isTTY && !isAgent,
  globals: false,
  environment: 'node',
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
  reporters: [
    [isAgent ? 'agent' : 'default', {}],
    ...(process.env.GITHUB_ACTIONS === 'true' ? [['github-actions', {}]] : []),
  ] as any,
  silent: false,
  hideSkippedTests: false,
  api: false,
  ui: false,
  uiBase: '/__vitest__/',
  open: !isCI,
  css: {
    include: [],
  },
  coverage: coverageConfigDefaults,
  fakeTimers: fakeTimersDefaults,
  maxConcurrency: 5,
  dangerouslyIgnoreUnhandledErrors: false,
  typecheck: {
    checker: 'tsc' as const,
    include: ['**/*.{test,spec}-d.?(c|m)[jt]s?(x)'],
    exclude: defaultExclude,
  },
  slowTestThreshold: 300,
  taskTitleValueFormatTruncate: 40,
  disableConsoleIntercept: false,
  detectAsyncLeaks: false,
})
