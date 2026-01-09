import { expect, test } from 'vitest'

test('window is not defined', () => {
  expect(typeof window).toBe('undefined')
})
