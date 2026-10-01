import { createRequire } from 'node:module'
import * as fs from 'node:fs'
import { expect, test } from 'vitest'
import * as raw from './src/external/raw-cjs.cjs'
import * as collision from './src/external/collision-cjs.cjs'

const require = createRequire(import.meta.url)

// https://nodejs.org/api/esm.html#commonjs-namespaces
test('cjs namespace provides the raw exports as "module.exports"', () => {
  expect(raw['module.exports']).toEqual({ a: 1 })
  expect(raw['module.exports']).toBe(require('./src/external/raw-cjs.cjs'))
  expect(raw.default).toBe(raw['module.exports'])
  expect(raw.a).toBe(1)
})

test('dynamic import provides the same "module.exports" export', async () => {
  const ns = await import('./src/external/raw-cjs.cjs')
  expect(ns['module.exports']).toBe(require('./src/external/raw-cjs.cjs'))
})

test('synthetic "module.exports" shadows a real property of that name', () => {
  expect(collision['module.exports']).toBe(require('./src/external/collision-cjs.cjs'))
  expect(collision['module.exports']['module.exports']).toBe('shadowed')
  expect(collision.x).toBe(1)
})

test('builtin namespaces do not provide "module.exports"', () => {
  expect('module.exports' in fs).toBe(false)
})
