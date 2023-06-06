import { expect, test } from 'vitest'

test('hi', () => {
  expect(1 + 1).toEqual(3)
})

test('hi soft', () => {
  expect.soft(1 + 1).toEqual(3)
})
