import { expectTypeOf, test } from 'vitest'

test.only('failing test', () => {
  expectTypeOf(1).toEqualTypeOf<string>()
})
