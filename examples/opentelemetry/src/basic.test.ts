import { expect, test } from 'vitest'
import { sleep } from './basic'

test('one plus one', async () => {
  await sleep(100)
  expect(1 + 1).toBe(2)
})

test('one plus two', async () => {
  expect(1 + 2).toBe(3)
})
