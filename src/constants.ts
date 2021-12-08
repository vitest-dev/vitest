import { resolve } from 'path'
import { fileURLToPath } from 'url'

export const defaultIncludes = ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
export const defaultExcludes = ['**/node_modules/**', '**/dist/**']

export const distDir = resolve(fileURLToPath(import.meta.url), '../../dist')

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
  // sinon
  'sinon',
  'spy',
  'mock',
  'stub',
  // hooks
  'beforeAll',
  'afterAll',
  'beforeEach',
  'afterEach',
]
