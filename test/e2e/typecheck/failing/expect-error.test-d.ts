import { expectTypeOf, test } from 'vitest'

//
test('failing test with expect-error', () => {
  // @ts-expect-error expect nothing
  expectTypeOf(1).toEqualTypeOf<number>()
})
