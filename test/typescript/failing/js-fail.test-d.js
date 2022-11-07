// @ts-check

import { expectTypeOf, test } from 'vitest'

test('js test fails', () => {
  expectTypeOf(1).toBeArray()
})
