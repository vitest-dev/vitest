// rollup dts building will external vitest
// so output dts entry using vitest to import internal types
// eslint-disable-next-line no-restricted-imports
import type { ResolvedC8Options, UserConfig } from 'vitest'

export const defaultInclude = ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
export const defaultExclude = ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**']

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
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress}.config.{js,cjs,mjs,ts}',
  '**/.{eslint,mocha,prettier}rc.{js,cjs,yml}',
]

const coverageConfigDefaults = {
  enabled: false,
  clean: true,
  cleanOnRerun: false,
  reportsDirectory: './coverage',
  excludeNodeModules: true,
  exclude: defaultCoverageExcludes,
  reporter: ['text', 'html'],
  allowExternal: false,
  // default extensions used by c8, plus '.vue' and '.svelte'
  // see https://github.com/istanbuljs/schema/blob/master/default-extension.js
  extension: ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte'],
} as ResolvedC8Options

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
  teardownTimeout: 1000,
  isolate: true,
  watchExclude: ['**/node_modules/**', '**/dist/**'],
  forceRerunTriggers: [
    '**/package.json/**',
    '**/vitest.config.*/**',
    '**/vite.config.*/**',
  ],
  update: false,
  reporters: [],
  silent: false,
  api: false,
  ui: false,
  uiBase: '/__vitest__/',
  open: true,
  css: {
    include: [/\.module\./],
  },
  coverage: coverageConfigDefaults,
  fakeTimers: fakeTimersDefaults,
  maxConcurrency: 5,
}

export const configDefaults: Required<Pick<UserConfig, keyof typeof config>> = Object.freeze(config)
