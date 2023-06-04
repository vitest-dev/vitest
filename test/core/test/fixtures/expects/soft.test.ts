import { expect, test } from 'vitest'

expect.extend({
  toBeSquare(received, expected) {
    const pass = received === expected * expected
    if (pass) {
      return {
        pass: true,
        received,
        expected,
        message: () => `expected ${received} not to be square`,
      }
    }
    else {
      return {
        pass: false,
        received,
        expected,
        message: () => `expected ${received} to be square`,
      }
    }
  },
})

test('basic', () => {
  expect.soft(1).toBe(2)
  expect.soft(2).toBe(3)
})

test('promise', async () => {
  await expect.soft(
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(1)
      })
    }),
  ).resolves.toBe(2)
  await expect.soft(
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(2)
      })
    }),
  ).resolves.toBe(3)
})

test('expect with expect.soft', () => {
  expect.soft(1).toEqual(2)
  expect(10).toEqual(20)
  expect.soft(2).toEqual(3)
})

test('expect.soft with expect.extend', () => {
  expect.soft(1).toEqual(2)
  // @ts-expect-error expect-extend
  expect.soft(3).toBeSquare(5)
  expect(5).toEqual(6)
})

test('expect.soft successfully', () => {
  expect.soft(1).toEqual(1)
  expect(10).toEqual(10)
  expect.soft(2).toEqual(2)
})
