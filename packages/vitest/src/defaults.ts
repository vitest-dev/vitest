import type { BenchmarkUserOptions, ResolvedCoverageOptions, UserConfig } from './types'

export const defaultInclude = ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
export const defaultExclude = ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*']
export const benchmarkConfigDefaults: Required<Omit<BenchmarkUserOptions, 'outputFile'>> = {
  include: ['**/*.{bench,benchmark}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  exclude: defaultExclude,
  includeSource: [],
  reporters: ['default'],
}

const defaultCoverageExcludes = [
  'coverage/**',
  'dist/**',
  'packages/*/test{,s}/**',
  '**/*.d.ts',
  'cypress/**',
  'test{,s}/**',
  'test{,-*}.{js,cjs,mjs,ts,tsx,jsx}',
  '**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx}',
  '**/*{.,-}spec.{js,cjs,mjs,ts,tsx,jsx}',
  '**/__tests__/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
  '**/.{eslint,mocha,prettier}rc.{js,cjs,yml}',
]

// These are the generic defaults for coverage. Providers may also set some provider speficic defaults.
export const coverageConfigDefaults: ResolvedCoverageOptions = {
  provider: 'c8',
  enabled: false,
  clean: true,
  cleanOnRerun: true,
  reportsDirectory: './coverage',
  exclude: defaultCoverageExcludes,
  reporter: ['text', 'html', 'clover', 'json'],
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
  allowOnly: !process.env.CI,
  watch: !process.env.CI,
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
    include: ['**/*.{test,spec}-d.{ts,js}'],
    exclude: defaultExclude,
  },
  slowTestThreshold: 300,
}

export const configDefaults: Required<Pick<UserConfig, keyof typeof config>> = Object.freeze(config)
