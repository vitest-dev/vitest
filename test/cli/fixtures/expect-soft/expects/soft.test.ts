import { expect, test } from 'vitest'

interface CustomMatchers<R = unknown> {
  toBeAsync: (expected: unknown) => Promise<R>;
  toBeDividedBy(divisor: number): R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
}

expect.extend({
  toBeAsync: async function (received, expected) {
    return {
      pass: received === expected,
      message: () => `expected ${received} to be ${expected} (asynchronously)`,
    };
  },
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

test('with expect', () => {
  expect.soft(1).toEqual(2)
  expect(10).toEqual(20)
  expect.soft(2).toEqual(3)
})

test('with expect.extend', () => {
  expect.soft(1).toEqual(2)
  expect.soft(3).toBeDividedBy(4)
  expect(5).toEqual(6)
})

test('promise with expect.extend', async () => {
  await expect.soft(1 + 1).toBeAsync(3);
  await expect.soft(1 + 2).toBeAsync(3);
  await expect.soft(2 + 2).toBeAsync(3);
});

test('passed', () => {
  expect.soft(1).toEqual(1)
  expect(10).toEqual(10)
  expect.soft(2).toEqual(2)
})

let num = 0
test('retry will passed', { retry: 1 }, () => {
  expect.soft(num += 1).toBe(3)
  expect.soft(num += 1).toBe(4)
})

num = 0
test('retry will failed', { retry: 1 }, () => {
  expect.soft(num += 1).toBe(4)
  expect.soft(num += 1).toBe(5)
})
