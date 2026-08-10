import { expect, test } from 'vitest'

test('uses repeats from config', () => {
  expect(1 + 1).toBe(2)
})

test('test option overrides config', { repeats: 1 }, () => {
  expect(1 + 1).toBe(2)
})
