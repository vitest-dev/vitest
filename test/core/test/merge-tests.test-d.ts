import { expectTypeOf, mergeTests, test } from 'vitest'

const testA = test.extend({
  a: 1,
})

const testB = test.extend({
  b: 2,
})

const merged = mergeTests(testA, testB)

merged('types', ({ a, b }) => {
  expectTypeOf(a).not.toBeAny()
  expectTypeOf(b).not.toBeAny()
  expectTypeOf(a).toEqualTypeOf<number>()
  expectTypeOf(b).toEqualTypeOf<number>()
})

const testC = test.extend({
  c: 'string',
})

const merged3 = mergeTests(merged, testC)

merged3('chained merge types', ({ a, b, c }) => {
  expectTypeOf(a).toBeNumber()
  expectTypeOf(b).toBeNumber()
  expectTypeOf(c).toBeString()
})

const testBool = test.extend({
  d: true,
})

const mergedVariadic = mergeTests(testA, testB, testBool)

mergedVariadic('variadic types', ({ a, b, d }) => {
  expectTypeOf(a).toBeNumber()
  expectTypeOf(b).toBeNumber()
  expectTypeOf(d).toBeBoolean()
})
