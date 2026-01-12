import { expect, test } from 'vitest'

test('1 - first.test.ts - this should pass', async () => {
  await new Promise(resolve => setTimeout(resolve, 250))
  expect(true).toBeTruthy()
})

test('2 - first.test.ts - this should fail', () => {
  expect(false).toBeTruthy()
})

test('3 - first.test.ts - this should be skipped', () => {
  expect(true).toBeTruthy()
})
