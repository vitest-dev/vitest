import { expectTypeOf, it } from 'vitest'

it('typecheck works', () => {
  expectTypeOf(4).toBeNumber()
  expectTypeOf('').not.toBeNumber()
})
