import { afterAll, beforeAll, expect, test } from 'vitest'

beforeAll(() => {
  // should both appear in snapshot
  throw new Error('before all')
})

afterAll(() => {
  // should both appear in snapshot
  throw new Error('after all')
})

test('1 = 1', () => {
  expect(1).toBe(1)
})
