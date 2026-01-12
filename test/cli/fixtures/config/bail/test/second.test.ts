import { expect, test } from 'vitest'

// When using multi threads/forks the first test will start before failing.test.ts fails
const isThreads = import.meta.env.THREADS === 'true'

test(`1 - second.test.ts - this should ${isThreads ? 'pass' : 'be skipped'}`, async () => {
  await new Promise(resolve => setTimeout(resolve, 1500))
  expect(true).toBeTruthy()
})

test('2 - second.test.ts - this should be skipped', () => {
  expect(true).toBeTruthy()
})

test('3 - second.test.ts - this should be skipped', () => {
  expect(true).toBeTruthy()
})
