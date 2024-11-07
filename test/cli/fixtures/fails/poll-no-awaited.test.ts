import { expect, test } from 'vitest';

test('poll is not awaited once', () => {
  expect.poll(() => 2).toBe(2)
})

test('poll is not awaited several times', () => {
  expect.poll(() => 3).toBe(3)
  expect.poll(() => 'string').not.toBe('correct')
})

test('poll is not awaited but there is an async assertion afterwards', async () => {
  expect.poll(() => 4).toBe(4)
  await expect(new Promise((r) => setTimeout(() => r(3), 50))).resolves.toBe(3)
})

test('poll is not awaited but there is an error afterwards', async () => {
  expect.poll(() => 4).toBe(4)
  expect(3).toBe(4)
})
