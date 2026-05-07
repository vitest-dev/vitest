import { describe, expectTypeOf, test } from 'vitest'

test.each(['some-value'])('each: %s', () => {
  expectTypeOf(1).toEqualTypeOf(2)
})

test.each([1, 2])('each literal number: %s', (num) => {
  expectTypeOf(num).toEqualTypeOf<1 | 2>()
})

describe.each([1, 2])('describe.each literal number: %s', (num) => {
  test('keeps literal union', () => {
    expectTypeOf(num).toEqualTypeOf<1 | 2>()
  })
})

test.for(['some-value'])('for: %s', () => {
  expectTypeOf(1).toEqualTypeOf(2)
})

test.skipIf(false)('dynamic skip', () => {
  expectTypeOf(1).toEqualTypeOf(2)
})

test(`template string`, () => {
  expectTypeOf(1).toEqualTypeOf(2)
})

test(`template ${'some value'} string`, () => {
  expectTypeOf(1).toEqualTypeOf(2)
})

test(`template ${`literal`} string`, () => {
  expectTypeOf(1).toEqualTypeOf(2)
})

const name = 'some value'
test(name, () => {
  expectTypeOf(1).toEqualTypeOf(2)
})

test((() => 'some name')(), () => {
  expectTypeOf(1).toEqualTypeOf(2)
})
