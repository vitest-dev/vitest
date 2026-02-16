import { describe, expect, mergeTests, test } from 'vitest'

describe('mergeTests', () => {
  const testA = test.extend({
    a: 1,
  })
  const testB = test.extend({
    b: 2,
  })
  const merged = mergeTests(testA, testB)

  merged('merges fixtures from two tests', ({ a, b }) => {
    expect(a).toBe(1)
    expect(b).toBe(2)
  })

  describe('nested describe', () => {
    const testC = test.extend({
      a: 2,
    })
    const mergedOverride = mergeTests(testA, testC)

    mergedOverride('overrides fixtures', ({ a }) => {
      expect(a).toBe(2)
    })
  })

  const mergedReverse = mergeTests(testB, testA)

  mergedReverse('overrides fixtures (reverse)', ({ a }) => {
    expect(a).toBe(1)
  })

  const testD = test.extend({
    c: 3,
  })

  const mergedChained = mergeTests(mergeTests(testA, testB), testD)

  mergedChained('chained merge', ({ a, b, c }) => {
    expect(a).toBe(1)
    expect(b).toBe(2)
    expect(c).toBe(3)
  })

  describe('shared base', () => {
    const base = test.extend({
      base: 'base',
    })
    const derivedA = base.extend({
      a: 'a',
    })
    const derivedB = base.extend({
      b: 'b',
    })
    const mergedDerived = mergeTests(derivedA, derivedB)

    mergedDerived('shared base fixtures', ({ base, a, b }) => {
      expect(base).toBe('base')
      expect(a).toBe('a')
      expect(b).toBe('b')
    })
  })

  describe('variadic merge (A, B, C) overrides correctly', () => {
    const testA = test.extend({
      a: 1,
      shared: 'a',
    })
    const testB = test.extend({
      b: 2,
      shared: 'b',
    })
    const testC = test.extend({
      c: 3,
      shared: 'c',
    })

    const merged = mergeTests(testA, testB, testC)

    merged('inherits all fixtures and overrides from last', ({ a, b, c, shared }) => {
      expect(a).toBe(1)
      expect(b).toBe(2)
      expect(c).toBe(3)
      expect(shared).toBe('c')
    })
  })

  describe('overrides', () => {
    describe('top-level', () => {
      const base = test.extend({ a: 1 })
      base.override({ a: 2 })
      const merged = mergeTests(base)

      merged('confirms top-level overrides are respected', ({ a }) => {
        expect(a).toBe(2)
      })
    })

    describe('scoped', () => {
      const base = test.extend({ a: 1 })
      base.override({ a: 2 })
      const merged = mergeTests(base)

      merged('confirms scoped overrides are respected', ({ a }) => {
        expect(a).toBe(2)
      })
    })
  })
})
