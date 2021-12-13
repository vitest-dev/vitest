import { resolve } from 'path'
import { fileURLToPath } from 'url'

export const distDir = resolve(fileURLToPath(import.meta.url), '../../dist')

export const defaultIncludes = ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
export const defaultExcludes = ['**/node_modules/**', '**/dist/**']

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
  // tinyspy
  'spy',
  'spyOn',
  'vitest',
  // hooks
  'beforeAll',
  'afterAll',
  'beforeEach',
  'afterEach',
]
