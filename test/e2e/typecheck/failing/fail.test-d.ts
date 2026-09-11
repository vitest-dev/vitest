import { describe, expectTypeOf, test } from 'vitest'

test('failing test', () => {
  expectTypeOf(1).toEqualTypeOf<string>()
})

describe('nested suite', () => {
  describe('nested 2', () => {
    test('failing test 2', () => {
      expectTypeOf(1).toBeVoid()
      expectTypeOf(1).toBeUndefined()
    })
  })

  expectTypeOf(1).toBeVoid()
})
