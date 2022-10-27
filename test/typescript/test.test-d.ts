import { describe, expectTypeOf, test } from 'vitest'

describe('test', () => {
  test('some-test', () => {
    expectTypeOf(45).toEqualTypeOf(45)
  })

  describe('test2', () => {
    test('some-test 2', () => {
      expectTypeOf(45).toEqualTypeOf(45)
    })
  })
})

expectTypeOf({ wolk: 'true' }).toHaveProperty('wolk')
