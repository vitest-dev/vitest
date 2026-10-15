import { expect, test } from 'vitest'

test('runs in a DOM environment', () => {
  expect(typeof document).toBe('object')
})
