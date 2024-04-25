import { createRequire } from 'node:module'
import { describe, expect, test } from 'vitest'

const require = createRequire(import.meta.url)

test('can require if package.json is null', () => {
  expect(() => require('./src/external/package-null/package-null.js')).not.toThrow()
})

describe('validating nested defaults in isolation', async () => {
  const nestedDefaultExternalCjs = await import('./src/external/export-nested-default-cjs.js')
  const moduleDefaultCjs = await import('./src/external/export-default-cjs.js')

  test('nested default should be resolved', () => {
    expect(nestedDefaultExternalCjs).toHaveProperty('default')
    expect(nestedDefaultExternalCjs.default).not.toHaveProperty('default')
    expect(nestedDefaultExternalCjs.default.a).toBe('a')
    expect(nestedDefaultExternalCjs.default.b).toBe('b')
    expect(nestedDefaultExternalCjs.a).toBe('a')
    expect(nestedDefaultExternalCjs.b).toBe('b')
  })

  test('externalized "module.exports" CJS module interops default', () => {
    expect(moduleDefaultCjs).toHaveProperty('default')
    expect(moduleDefaultCjs.default).toHaveProperty('a')
    expect(moduleDefaultCjs.default.a).toBe('a')
    expect(moduleDefaultCjs).toHaveProperty('a')
    expect(moduleDefaultCjs.a).toBe('a')
  })
})
