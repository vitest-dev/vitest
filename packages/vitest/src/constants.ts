import { fileURLToPath } from 'url'
import { resolve } from 'pathe'
import type { UserConfig } from './types'
import { defaults as coverageDefaults } from './integrations/coverage'

export const distDir = resolve(fileURLToPath(import.meta.url), '../../dist')

export const defaultInclude = ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
export const defaultExclude = ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**']

export const defaults: UserConfig = {
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
  coverage: coverageDefaults,
}

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
