import { expect, test } from 'vitest'

expect.extend({
  toBeDividedBy(received, divisor) {
    const pass = received % divisor === 0
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be divisible by ${divisor}`,
        pass: true,
      }
    }
    else {
      return {
        message: () =>
          `expected ${received} to be divisible by ${divisor}`,
        pass: false,
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
  expect.soft(3).toBeDividedBy(4)
  expect(5).toEqual(6)
})

test('expect.soft passed', () => {
  expect.soft(1).toEqual(1)
  expect(10).toEqual(10)
  expect.soft(2).toEqual(2)
})

let num = 0
test('expect.soft and retry will passed', () => {
  expect.soft(num += 1).toBe(3)
  expect.soft(num += 1).toBe(4)
}, {
  retry: 2,
})

num = 0
test('expect.soft and retry will failed', () => {
  expect.soft(num += 1).toBe(4)
  expect.soft(num += 1).toBe(5)
}, {
  retry: 2,
})
