import { expectTypeOf, test } from 'vitest'

test('ok', () => {
  expectTypeOf(1).toEqualTypeOf(2)
})
