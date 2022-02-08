import { fileURLToPath } from 'url'
import { resolve } from 'pathe'
import type { ResolvedC8Options, UserConfig } from './types'

export const distDir = resolve(fileURLToPath(import.meta.url), '../../dist')

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
  '**/.{eslint,mocha}rc.{js,cjs}',
]

export const defaultCoverageConfig = Object.freeze({
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
}) as ResolvedC8Options

export const defaultConfig: UserConfig = Object.freeze({
  globals: false,
  environment: 'node',
  threads: true,
  clearMocks: false,
  restoreMocks: false,
  mockReset: false,
  include: defaultInclude,
  exclude: defaultExclude,
  testTimeout: 5_000,
  hookTimeout: 10_000,
  isolate: true,
  watchIgnore: [/\/node_modules\//, /\/dist\//],
  update: false,
  watch: true,
  reporters: 'default',
  silent: false,
  api: false,
  ui: false,
  uiBase: '/__vitest__/',
  open: true,
  coverage: defaultCoverageConfig,
})

// if changed, update also jsdocs and docs
export const defaultPort = 51204

export const API_PATH = '/__vitest_api__'

export const configFiles = [
  'vitest.config.ts',
  'vitest.config.js',
  'vitest.config.mjs',
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
]

export const globalApis = [
  // suite
  'suite',
  'test',
  'describe',
  'it',
  // chai
  'chai',
  'expect',
  'assert',
  // utils
  'vitest',
  'vi',
  // hooks
  'beforeAll',
  'afterAll',
  'beforeEach',
  'afterEach',
]
