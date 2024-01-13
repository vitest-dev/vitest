import { expect, test } from 'vitest'

test('window is defined', () => {
  expect(typeof window).toBe('object')
})

test('"defined" from workspace inline config', () => {
  // TODO
  // expect(typeof TEST_DEIFNE).toBe("string")
})
