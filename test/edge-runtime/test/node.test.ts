import { expect, test } from 'vitest'

test('node env should not have crypto', () => {
  expect(globalThis).not.toHaveProperty('crypto')
})
