import type { A } from 'project-a'
import { a } from 'project-a'
import { describe, expectTypeOf, it } from 'vitest'

describe('Import types from project references', () => {
  it('should import value and type from project references', () => {
    expectTypeOf(a).toEqualTypeOf<A>()
  })
})
