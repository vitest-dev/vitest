import { expectTypeOf, mergeTests, test } from 'vitest'

const t1 = test.extend({ a: 1 })
const t2 = test.extend({ b: 2 })
const merged = mergeTests(t1, t2)

merged('types', ({ a, b }) => {
  expectTypeOf(a).not.toBeAny()
  expectTypeOf(b).not.toBeAny()
  expectTypeOf(a).toEqualTypeOf<number>()
  expectTypeOf(b).toEqualTypeOf<number>()
})

const t3 = test.extend({ c: 'string' })
const merged3 = mergeTests(merged, t3)

merged3('chained merge types', ({ a, b, c }) => {
  expectTypeOf(a).toBeNumber()
  expectTypeOf(b).toBeNumber()
  expectTypeOf(c).toBeString()
})

const tBool = test.extend({ d: true })
const mergedVariadic = mergeTests(t1, t2, tBool)

mergedVariadic('variadic types', ({ a, b, d }) => {
  expectTypeOf(a).toBeNumber()
  expectTypeOf(b).toBeNumber()
  expectTypeOf(d).toBeBoolean()
})

const tOverrideNever1 = test.extend<{ a: number }>({ a: 1 })
const tOverrideNever2 = test.extend<{ a: string }>({ a: async ({}, use) => use('string') })
const mergedOverrideNever = mergeTests(tOverrideNever1, tOverrideNever2)

mergedOverrideNever('override type ensures last wins without never', ({ a }) => {
  // Should be string (last wins)
  expectTypeOf(a).toEqualTypeOf<string>()
})

interface ComplexType {
  nested: { deep: { value: string } }
  fn: (arg: number) => boolean
}

const tComplex = test.extend<{ complex: ComplexType }>({
  complex: {
    nested: { deep: { value: 'test' } },
    fn: n => n > 0,
  },
})

const mergedComplex = mergeTests(t1, tComplex)
mergedComplex('type inference works on deep objects', ({ complex }) => {
  expectTypeOf(complex.nested.deep.value).toEqualTypeOf<string>()
  expectTypeOf(complex.fn).toEqualTypeOf<(arg: number) => boolean>()
})
