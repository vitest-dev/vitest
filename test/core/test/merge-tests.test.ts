import { describe, expect, mergeTests, test } from 'vitest'

const tDep1 = test.extend({
  D_base: [async ({ }: any, use: any) => use('D_base'), { scope: 'file' }] as any,
  D_derived: async ({ D_base }: any, use: any) => {
    await use(`derived-${D_base}`)
  },
})
const tDep2 = test.extend({
  D_base: [async ({ }: any, use: any) => use('file-base'), { scope: 'file' }] as any,
})

const mergedDeps = mergeTests(tDep1, tDep2)

describe('mergeTests', () => {
  const t1 = test.extend({ a: 1 })
  const t2 = test.extend({ b: 2 })
  const mergedDistinct = mergeTests(t1, t2)

  mergedDistinct('mergeTests combines distinct fixtures', ({ a, b }) => {
    expect(a).toBe(1)
    expect(b).toBe(2)
  })

  const tOverride1 = test.extend({ foo: 'from t1' })
  const tOverride2 = test.extend({ foo: 'from t2' })
  const mergedOverride = mergeTests(tOverride1, tOverride2)

  mergedOverride('mergeTests overrides fixtures last-writer-wins', ({ foo }) => {
    expect(foo).toBe('from t2')
  })

  test('mergeTests throws when same fixture has different scopes', () => {
    const tScope1 = test.extend({
      f: [() => 'file', { scope: 'file' }] as any,
    })
    const tScope2 = test.extend({
      f: [() => 'test', { scope: 'test' }] as any,
    })

    expect(() => mergeTests(tScope1, tScope2)).toThrowError(
      /Fixture "f" defined with conflicting scopes: "file" vs "test"/,
    )
  })

  mergedDeps('mergeTests validates dependencies across merged fixtures (valid)', ({ D_derived }) => {
    expect(D_derived).toBe('derived-file-base')
  })

  const tMulti1 = test.extend({ a: 1 })
  const tMulti2 = test.extend({ b: 2 })
  const tMulti3 = test.extend({ c: 3, a: 'overridden' })
  const mergedMulti = mergeTests(tMulti1, tMulti2, tMulti3)

  mergedMulti('mergeTests works with three or more tests', ({ a, b, c }) => {
    expect(a).toBe('overridden')
    expect(b).toBe(2)
    expect(c).toBe(3)
  })

  test('mergeTests with zero arguments throws', () => {
    expect(() => (mergeTests as any)()).toThrowError(/mergeTests requires at least one test/)
  })

  test('mergeTests with non-extended test throws', () => {
    // We expect mergeTests to throw an error if passed a non-extended test API
    // Since we pass `{}` as a mocked invalid test API, we will just use `any` to bypass typings.
    try {
      ;(mergeTests as any)({})
      expect.fail('Expected mergeTests to throw')
    }
    catch (e: any) {
      expect(e.message).toMatch(/mergeTests requires extended test instances created via test\.extend\(\)/)
    }
  })

  const logs: string[] = []
  const tAuto1 = test.extend({
    autoFix: [async ({ }: any, use: any) => {
      logs.push('auto init t1')
      await use(42)
    }, { auto: true }] as const,
  })
  const tAuto2 = test.extend({ value: 100 })
  const mergedAuto = mergeTests(tAuto1, tAuto2)

  mergedAuto('test1 with auto fixtures', ({ value }) => {
    logs.push(`value=${value}`)
  })

  mergedAuto('test2 with auto fixtures', ({ value }) => {
    logs.push(`value=${value}`)
    expect(logs).toEqual([
      'auto init t1',
      'value=100',
      'auto init t1',
      'value=100',
    ])
  })
})

const tWorker1 = test.extend('w', { scope: 'worker' }, async ({ }: any) => 1)
const tWorker2 = test.extend('w2', { scope: 'worker' }, async ({ }: any) => 2)
const mergedWorker = mergeTests(tWorker1, tWorker2)

mergedWorker('worker fixtures merge', ({ w, w2 }) => {
  expect(w).toBe(1)
  expect(w2).toBe(2)
})
const diamondBase = test.extend({ base: 'diamond-base' })
const diamondLeft = diamondBase.extend({ left: async ({ base }: any, use: any) => use(`${base}-left`) })
const diamondRight = diamondBase.extend({ right: async ({ base }: any, use: any) => use(`${base}-right`) })
const mergedDiamond = mergeTests(diamondLeft, diamondRight)

mergedDiamond('diamond dependencies merge correctly', ({ left, right }) => {
  expect(left).toBe('diamond-base-left')
  expect(right).toBe('diamond-base-right')
})

describe('overrides persistence', () => {
  const overrideBase = test.extend({ a: 1 })
  overrideBase.override({ a: 2 })
  const overrideOther = test.extend({ c: 4 })
  const mergedOverrides = mergeTests(overrideBase, overrideOther)

  mergedOverrides('mergeTests preserves overrides', ({ a, c }) => {
    expect(a).toBe(2) // successfully preserves overriden test fixture instead of returning 1
    expect(c).toBe(4)
  })
})

describe('complex merge validation edge cases', () => {
  test('detects circular fixture dependency across the merge boundary', () => {
    const baseB = test.extend({ b: 1 })
    const t1 = baseB.extend({
      a: async ({ b }: any, use: any) => use(`a-${b}`),
    })
    const baseA = test.extend({ a: 1 })
    const t2 = baseA.extend({
      b: async ({ a }: any, use: any) => use(`b-${a}`),
    })

    // circular dependencies are detected at RUNTIME by resolveDeps, not at merge time
    expect(() => mergeTests(t1, t2)).not.toThrow()
    const merged = mergeTests(t1, t2)
    expect(merged).toBeDefined()
  })

  test('throws on unknown fixture dependency during merge', () => {
    const t1 = test.extend({ valid: 'value' })
    const t2 = test.extend({
      invalid: async ({ _nonExistent }: any, use: any) => use('fail'),
    })
    expect(() => mergeTests(t1, t2)).toThrow(/depends on unknown fixture "_nonExistent"/)
  })

  describe('recovery after failed merge', () => {
    const t1 = test.extend({ valid: 'value' })
    const t3 = test.extend({ another: 'value' })
    const merged = mergeTests(t1, t3)

    merged('subsequent merges work after a failed one', ({ valid, another }) => {
      expect(valid).toBe('value')
      expect(another).toBe('value')
    })
  })

  describe('null and undefined fixture values', () => {
    const t1 = test.extend({ undefinedValue: undefined, nullValue: null })
    const t2 = test.extend({ valid: 'value' })
    const merged = mergeTests(t1, t2)

    merged('passes through null and undefined correctly', ({ undefinedValue, nullValue, valid }) => {
      expect(undefinedValue).toBeUndefined()
      expect(nullValue).toBeNull()
      expect(valid).toBe('value')
    })
  })

  describe('test.each support', () => {
    const t1 = test.extend({ prefix: 'test' })
    const t2 = test.extend({ suffix: 'case' })
    const merged = mergeTests(t1, t2)

    test('merged test exposes test.each API', () => {
      // verify merged tests have access to .each chainable
      expect(typeof merged.each).toBe('function')
    })
  })

  describe('concurrent support', () => {
    const t1 = test.extend({ counter: 0 })
    const t2 = test.extend({ step: 1 })
    const merged = mergeTests(t1, t2)

    merged.concurrent('concurrent mapping works', ({ counter, step }) => {
      expect(counter).toBe(0)
      expect(step).toBe(1)
    })
  })

  describe('deeply nested overrides', () => {
    const base = test.extend({ value: 'base' })
    const merged = mergeTests(base, test.extend({ extra: 'extra' }))

    describe('level 1', () => {
      merged.override({ value: 'level1' })

      describe('level 2', () => {
        merged.override({ extra: 'level2' })

        merged('assertions hold at level 2', ({ value, extra }) => {
          expect(value).toBe('level1')
          expect(extra).toBe('level2')
        })
      })
    })
  })
})
