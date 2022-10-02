import url from 'url'
import { resolve } from 'pathe'
import { isNode } from './utils/env'

export const rootDir = isNode ? resolve(url.fileURLToPath(import.meta.url), '../../') : import.meta.url
export const distDir = isNode ? resolve(url.fileURLToPath(import.meta.url), '../../dist') : import.meta.url

// if changed, update also jsdocs and docs
export const defaultPort = 51204

export const EXIT_CODE_RESTART = 43

export const API_PATH = '/__vitest_api__'

export const configFiles = [
  'vitest.config.ts',
  'vitest.config.mts',
  'vitest.config.cts',
  'vitest.config.js',
  'vitest.config.mjs',
  'vitest.config.cjs',
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.cts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
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
  // typecheck
  'expectTypeOf',
  'assertType',
  // utils
  'vitest',
  'vi',
  // hooks
  'beforeAll',
  'afterAll',
  'beforeEach',
  'afterEach',
]
