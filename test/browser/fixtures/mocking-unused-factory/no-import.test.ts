import { expect, test } from 'vitest'

test('no test imports the mocked module', () => {
  expect(1 + 1).toBe(2)
})
