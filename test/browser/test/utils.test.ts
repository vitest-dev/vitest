import { inspect } from 'vitest/utils'
import { expect, it } from 'vitest'

it('utils package correctly uses loupe', async () => {
  expect(inspect({ test: 1 })).toBe('{ test: 1 }')
})
