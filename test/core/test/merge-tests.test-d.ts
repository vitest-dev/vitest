import { expectTypeOf, mergeTests, test } from 'vitest'

const testA = test.extend({
  a: 1,
})

const testB = test.extend({
  b: 2,
})

const merged = mergeTests(testA, testB)

merged('types', ({ a, b }) => {
  expectTypeOf(a).toBeNumber()
  expectTypeOf(b).toBeNumber()
})

const testC = test.extend({
  c: 'string',
})

const merged3 = mergeTests(merged, testC)

merged3('chained types', ({ a, b, c }) => {
  expectTypeOf(a).toBeNumber()
  expectTypeOf(b).toBeNumber()
  expectTypeOf(c).toBeString()
})
