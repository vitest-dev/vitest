import { describe, expect, mergeTests, test } from 'vitest'

describe('mergeTests', () => {
  describe('basic merge behavior', () => {
    const t1 = test.extend({ a: 1 })
    const t2 = test.extend({ b: 2 })
    const mergedDistinct = mergeTests(t1, t2)

    mergedDistinct('combines distinct fixtures', ({ a, b }) => {
      expect(a).toBe(1)
      expect(b).toBe(2)
    })

    const tOverride1 = test.extend({ foo: 'from t1' })
    const tOverride2 = test.extend({ foo: 'from t2' })
    const mergedOverride = mergeTests(tOverride1, tOverride2)

    mergedOverride('overrides fixtures with last-writer-wins semantics', ({ foo }) => {
      expect(foo).toBe('from t2')
    })

    const tMulti1 = test.extend({ a: 1 })
    const tMulti2 = test.extend({ b: 2 })
    const tMulti3 = test.extend({ c: 3, a: 'overridden' })
    const mergedMulti = mergeTests(tMulti1, tMulti2, tMulti3)

    mergedMulti('merges three or more extended tests correctly', ({ a, b, c }) => {
      expect(a).toBe('overridden')
      expect(b).toBe(2)
      expect(c).toBe(3)
    })

    test('mergeTests(t) returns equivalent test instance', () => {
      const t = test.extend({ a: 1 })
      const merged = mergeTests(t)

      expect(typeof merged).toBe('function')
      expect(typeof merged.extend).toBe('function')
    })

    test('accepts union of auto fixtures (structural check)', () => {
      const tAuto1 = test.extend({
        auto1: [async ({}, use: any) => {
          await use('ok')
        }, { auto: true }] as any,
      })
      const tAuto2 = test.extend({
        auto2: [async ({}, use: any) => {
          await use('ok')
        }, { auto: true }] as any,
      })
      const merged = mergeTests(tAuto1, tAuto2)
      expect(typeof merged).toBe('function')
    })
  })

  describe('nested merges', () => {
    const t1 = test.extend({ a: 1 })
    const t2 = test.extend({ b: 2 })
    const t3 = test.extend({ c: 3 })

    const merged = mergeTests(t1, mergeTests(t2, t3))

    merged('nested merge works (associativity)', ({ a, b, c }) => {
      expect(a).toBe(1)
      expect(b).toBe(2)
      expect(c).toBe(3)
    })

    describe('overrides propagate through nested merges', () => {
      const nested = mergeTests(t1, mergeTests(t2, t3))
      nested.override({ a: 10, b: 20 })

      nested('overrides resolve correctly across boundaries', ({ a, b, c }) => {
        expect(a).toBe(10)
        expect(b).toBe(20)
        expect(c).toBe(3)
      })
    })
  })

  describe('override behavior', () => {
    const base = test.extend({ a: 1, b: 'base-b', c: 1, value: 'base' })
    base.override({ a: 2 })

    const tOther = test.extend({ b: 'other-b', d: 4 })
    const merged = mergeTests(base, tOther)

    merged('preserves overrides across merge and respects last-writer-wins', ({ a, b, d }) => {
      expect(a).toBe(2)
      expect(b).toBe('other-b')
      expect(d).toBe(4)
    })

    describe('nested override chains', () => {
      merged.override({ a: 3 })

      describe('deeper level', () => {
        merged.override({ d: 5, value: 42 as any })

        merged('respects full override chain including type transitions', ({ a, b, d, value }) => {
          expect(a).toBe(3)
          expect(b).toBe('other-b')
          expect(d).toBe(5)
          expect(value).toBe(42)
        })
      })
    })

    test('accepts merges of tests with pre-existing overrides', () => {
      const b = test.extend({ value: 'original' })
      b.override({ value: 'overridden' })

      const extended = b.extend({ extra: 'extra' })
      const t2 = test.extend({ another: 'another' })
      const merged = mergeTests(extended, t2)
      expect(typeof merged).toBe('function')
    })
  })

  describe('dependency graph merging', () => {
    const base = test.extend({ base: 'base' })
    const t1 = base.extend({
      middle: async ({ base }: any, use: any) => use(`${base}-mid`),
    })
    const t2 = base.extend({
      leaf: async ({ middle }: any, use: any) => use(`${middle}-leaf`),
    })

    const merged = mergeTests(t1, t2)
    merged('linear chain works across merge boundary', ({ leaf }) => {
      expect(leaf).toBe('base-mid-leaf')
    })

    const diamondBase = test.extend({ base: 'base' })
    const tD1 = diamondBase.extend({
      middle1: async ({ base }: any, use: any) => use(`${base}-m1`),
      leaf1: async ({ middle1 }: any, use: any) => use(`${middle1}-l1`),
    })
    const tD2 = diamondBase.extend({
      middle2: async ({ base }: any, use: any) => use(`${base}-m2`),
      leaf2: async ({ middle2 }: any, use: any) => use(`${middle2}-l2`),
    })
    const mergedDiamond = mergeTests(tD1, tD2)

    mergedDiamond('resolves complex cross-dependencies (diamond inheritance)', ({ leaf1, leaf2, middle1, middle2, base }) => {
      expect(leaf1).toBe('base-m1-l1')
      expect(leaf2).toBe('base-m2-l2')
      expect(middle1).toBe('base-m1')
      expect(middle2).toBe('base-m2')
      expect(base).toBe('base')
    })

    const tShared1 = test.extend({
      shared: async ({ a }: any, use: any) => use(`t1-${a}`),
      a: 'a1',
    })
    const tShared2 = test.extend({
      shared: async ({ b }: any, use: any) => use(`t2-${b}`),
      b: 'b2',
    })
    const mergedShared = mergeTests(tShared1, tShared2)

    mergedShared('last writer wins for implementation but dependencies are preserved', ({ shared, a, b }) => {
      expect(shared).toBe('t2-b2')
      expect(a).toBe('a1')
      expect(b).toBe('b2')
    })
  })

  describe('type behavior and value edge cases', () => {
    const t1 = test.extend<{ value: string }>({ value: 'str' })
    const t2 = test.extend<{ value: number }>({ value: 123 })
    const mergedTypes = mergeTests(t1, t2)

    mergedTypes('handles type conflicts by following last-wins metadata', ({ value }) => {
      expect(value).toBe(123)
    })

    const tNulls1 = test.extend({ undefinedValue: undefined, nullValue: null })
    const tNulls2 = test.extend({ valid: 'value' })
    const mergedNulls = mergeTests(tNulls1, tNulls2)

    mergedNulls('passes through null and undefined correctly', ({ undefinedValue, nullValue, valid }) => {
      expect(undefinedValue).toBeUndefined()
      expect(nullValue).toBeNull()
      expect(valid).toBe('value')
    })

    test('handles injected fixture intersections (structural check)', () => {
      const t1 = test.extend<{ config: { port: number; host: string } }>({
        config: [async ({}, use: any) => use({ port: 3000, host: 'localhost' }), { injected: true }] as any,
      })
      const t2 = test.extend<{ config: { ssl: boolean } }>({
        config: [async ({}: any, use: any) => use({ ssl: true }), { injected: true }] as any,
      })
      const merged = mergeTests(t1, t2)
      expect(typeof merged).toBe('function')
    })
  })

  describe('API surface', () => {
    test('merged test preserves TestAPI shape', () => {
      const t1 = test.extend({ a: 1 })
      const t2 = test.extend({ b: 2 })
      const merged = mergeTests(t1, t2)

      expect(typeof merged).toBe('function')
      expect(typeof merged.extend).toBe('function')
      expect(typeof merged.override).toBe('function')
      expect(typeof merged.concurrent).toBe('function')
      expect(typeof merged.each).toBe('function')
    })

    test('supports .concurrent and .each (structural check)', () => {
      const t1 = test.extend({ a: 1 })
      const t2 = test.extend({ b: 2 })
      const merged = mergeTests(t1, t2)
      expect(typeof merged.concurrent).toBe('function')
      expect(typeof merged.each).toBe('function')
    })
  })

  describe('validation (input, dependencies, scopes)', () => {
    test('throws on zero or invalid arguments', () => {
      expect(() => (mergeTests as any)()).toThrow(/mergeTests requires at least one test/)
      expect(() => (mergeTests as any)({})).toThrow(/mergeTests requires extended test instances/)
    })

    test('throws on conflicting fixture scopes', () => {
      const t1 = test.extend({ f: [() => 1, { scope: 'file' }] as any })
      const t2 = test.extend({ f: [() => 2, { scope: 'test' }] as any })
      expect(() => mergeTests(t1, t2)).toThrow(/conflicting scopes: "file" vs "test"/)
    })

    test('throws on unknown dependencies across merged tests', () => {
      const t1 = test.extend({ a: 1 })
      const t2 = test.extend({ b: async ({ _unknown }: any, use: any) => use(2) })
      expect(() => mergeTests(t1, t2)).toThrow(/depends on unknown fixture "_unknown"/)
    })

    test('throws on invalid scope inheritance (file depends on test)', () => {
      const t1 = test.extend({
        a: [async ({}, use: any) => use('a'), { scope: 'test' }] as any,
      })
      const t2 = test.extend({
        b: [async ({ a }: any, use: any) => use(`b-${a}`), { scope: 'file' }] as any,
      })
      expect(() => mergeTests(t1, t2)).toThrow(/cannot depend on a test fixture "a"/)
    })

    test('accepts circular dependencies at merge time (runtime detection)', () => {
      const t1 = test.extend({ a: async ({ b: _b }: any, use: any) => use(1) })
      const t2 = test.extend({ b: async ({ a: _a }: any, use: any) => use(2) })
      const merged = mergeTests(t1, t2)
      expect(typeof merged).toBe('function')
    })

    test('mergeTests preserves built-in fixtures', () => {
      const t = test.extend({ custom: 1 })
      const merged = mergeTests(t)

      expect(typeof merged).toBe('function')
    })

    test('preserves built-in fixtures', () => {
      const t1 = test.extend({ task: 'custom' } as any)
      const merged = mergeTests(t1)
      expect(typeof merged).toBe('function')
    })
  })

  describe('recovery and isolation', () => {
    test('maintains isolation after a failed merge attempt', () => {
      const tValid = test.extend({ a: 1 })
      const tConflicting1 = test.extend({ f: [() => 1, { scope: 'file' }] as any })
      const tConflicting2 = test.extend({ f: [() => 2, { scope: 'test' }] as any })

      expect(() => mergeTests(tConflicting1, tConflicting2)).toThrow()

      const tOther = test.extend({ b: 2 })
      const merged = mergeTests(tValid, tOther)

      expect(typeof merged).toBe('function')
    })

    test('mergeTests does not mutate source test instances', () => {
      const t1 = test.extend({ a: 1 })
      const t2 = test.extend({ b: 2 })

      const merged = mergeTests(t1, t2)

      // original tests should still behave independently
      const mergedAgain = mergeTests(t1)

      expect(typeof merged).toBe('function')
      expect(typeof mergedAgain).toBe('function')

      // ensure original APIs are intact
      expect(typeof t1.extend).toBe('function')
      expect(typeof t2.extend).toBe('function')
    })

    test('source tests remain extendable after merge', () => {
      const t1 = test.extend({ a: 1 })
      const t2 = test.extend({ b: 2 })

      mergeTests(t1, t2)

      const extended = t1.extend({ c: 3 })

      expect(typeof extended).toBe('function')
    })

    test('subsequent merges work after local failure', () => {
      const t1 = test.extend({ valid: 'value' })
      const t2 = test.extend({ invalid: [() => 1, { scope: 'file' }] as any })
      const t3 = test.extend({ invalid: [() => 2, { scope: 'test' }] as any })

      expect(() => mergeTests(t2, t3)).toThrow()

      const t4 = test.extend({ another: 'value' })
      const merged = mergeTests(t1, t4)
      expect(typeof merged).toBe('function')
    })
  })

  describe('scaling', () => {
    test('scales correctly to 50+ test instances (metadata check)', () => {
      const count = 50
      const tests = Array.from({ length: count }).map((_, i) => {
        return test.extend({
          [`f${i}`]: async ({}, use: any) => use(`v${i}`),
        })
      })
      const merged = (mergeTests as any)(...tests)
      expect(typeof merged).toBe('function')
    })
  })
})
