import { describe, expect, it } from 'vitest'

describe('runIf', () => {
  const shouldSkip = true

  it.skipIf(shouldSkip)('skipped', () => {
    throw new Error('foo')
  })

  it.skipIf(!shouldSkip)('not skipped', () => {
    expect(1).toBe(1)
  })

  it.runIf(!shouldSkip)('skipped 2', () => {
    throw new Error('foo')
  })

  it.runIf(shouldSkip)('not skipped 2', () => {
    expect(1).toBe(1)
  })

  /*
  it.runIf(!shouldSkip).each([1, 2, 3])('works with each skipped', (num) => {
    expect(Number.isInteger(num)).toBe(true)
  })

  it.runIf(shouldSkip).each([1, 2, 3])('works with each not skipped', (num) => {
    expect(Number.isInteger(num)).toBe(true)
  })
  */
})
