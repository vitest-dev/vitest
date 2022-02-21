import type { ResolvedC8Options, UserConfig } from './types'

export const defaultInclude = ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
export const defaultExclude = ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**']

const defaultCoverageExcludes = [
  'coverage/**',
  'packages/*/test{,s}/**',
  '**/*.d.ts',
  'cypress/**',
  'test{,s}/**',
  'test{,-*}.{js,cjs,mjs,ts,tsx,jsx}',
  '**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx}',
  '**/__tests__/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc}.config.{js,cjs,mjs,ts}',
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
  extension: ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.vue', 'svelte'],
} as ResolvedC8Options

export const configDefaults: UserConfig = Object.freeze({
  allowOnly: !process.env.CI,
  watch: !process.env.CI,
  globals: false,
  environment: 'node',
  threads: true,
  clearMocks: false,
  restoreMocks: false,
  mockReset: false,
  include: defaultInclude,
  exclude: defaultExclude,
  testTimeout: 5000,
  hookTimeout: 10000,
  isolate: true,
  watchIgnore: [/\/node_modules\//, /\/dist\//],
  update: false,
  reporters: [],
  silent: false,
  api: false,
  ui: false,
  uiBase: '/__vitest__/',
  open: true,
  coverage: coverageConfigDefaults,
})
