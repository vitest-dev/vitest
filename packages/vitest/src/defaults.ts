import type { BenchmarkUserOptions, ResolvedCoverageOptions, UserConfig } from './types'
import { isCI } from './utils/env'

export const defaultInclude = ['**/__tests__/**/*.?([cm])[jt]s?(x)', '**/?(*.){test,spec}.?([cm])[jt]s?(x)']
export const defaultExclude = ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*']
export const benchmarkConfigDefaults: Required<Omit<BenchmarkUserOptions, 'outputFile'>> = {
  include: ['**/*.{bench,benchmark}.?([cm])[jt]s?(x)'],
  exclude: defaultExclude,
  includeSource: [],
  reporters: ['default'],
}

const defaultCoverageExcludes = [
  'coverage/**',
  'dist/**',
  'packages/*/test?(s)/**',
  '**/*.d.ts',
  'cypress/**',
  'test?(s)/**',
  'test?(-*).?([cm])[jt]s?(x)',
  '**/*{.,-}{test,spec}.?([cm])[jt]s?(x)',
  '**/__tests__/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
  '**/.{eslint,mocha,prettier}rc.{?([cm])js,yml}',
]

// These are the generic defaults for coverage. Providers may also set some provider specific defaults.
export const coverageConfigDefaults: ResolvedCoverageOptions = {
  provider: 'c8',
  enabled: false,
  clean: true,
  cleanOnRerun: true,
  reportsDirectory: './coverage',
  exclude: defaultCoverageExcludes,
  reporter: [['text', {}], ['html', {}], ['clover', {}], ['json', {}]],
  // default extensions used by c8, plus '.vue' and '.svelte'
  // see https://github.com/istanbuljs/schema/blob/master/default-extension.js
  extension: ['.js', '.cjs', '.mjs', '.ts', '.mts', '.cts', '.tsx', '.jsx', '.vue', '.svelte'],
}

export const fakeTimersDefaults = {
  loopLimit: 10_000,
  shouldClearNativeTimers: true,
  toFake: [
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'setImmediate',
    'clearImmediate',
    'Date',
  ],
} as NonNullable<UserConfig['fakeTimers']>

const config = {
  allowOnly: !isCI,
  watch: !isCI,
  globals: false,
  environment: 'node' as const,
  threads: true,
  clearMocks: false,
  restoreMocks: false,
  mockReset: false,
  include: defaultInclude,
  exclude: defaultExclude,
  testTimeout: 5000,
  hookTimeout: 10000,
  teardownTimeout: 10000,
  isolate: true,
  watchExclude: ['**/node_modules/**', '**/dist/**'],
  forceRerunTriggers: [
    '**/package.json/**',
    '**/{vitest,vite}.config.*/**',
  ],
  update: false,
  reporters: [],
  silent: false,
  hideSkippedTests: false,
  api: false,
  ui: false,
  uiBase: '/__vitest__/',
  open: true,
  css: {
    include: [],
  },
  coverage: coverageConfigDefaults,
  fakeTimers: fakeTimersDefaults,
  maxConcurrency: 5,
  dangerouslyIgnoreUnhandledErrors: false,
  typecheck: {
    checker: 'tsc' as const,
    include: ['**/?(*.){test,spec}-d.?([cm])[jt]s?(x)'],
    exclude: defaultExclude,
  },
  slowTestThreshold: 300,
}

export const configDefaults: Required<Pick<UserConfig, keyof typeof config>> = Object.freeze(config)
