import { expectTypeOf, test } from 'vitest'

test('failing test', () => {
  expectTypeOf(1).toEqualTypeOf<string>()
})
