import { fileURLToPath } from 'url'
import { resolve } from 'pathe'

export const distDir = resolve(fileURLToPath(import.meta.url), '../../dist')

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
