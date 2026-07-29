import { expectTypeOf, it } from 'vitest'

it('1 plus 1', () => {
  expectTypeOf(1 + 1).toBeNumber()
})
