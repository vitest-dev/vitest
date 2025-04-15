import { describe, expectTypeOf, test } from 'vitest'

describe('test', () => {
  test('some-test', () => {
    expectTypeOf({ a: 1 }).toEqualTypeOf({ a: "should not match" })
  })
})
