import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from 'vitest'

beforeAll(() => {
  console.log('[beforeAll 1]')
})
beforeAll(() => {
  console.log('[beforeAll 2]')
})

afterAll(() => {
  console.log('[afterAll 1]')
})
afterAll(() => {
  console.log('[afterAll 2]')
})

beforeEach(() => {
  console.log('[beforeEach 1]')
})
beforeEach(() => {
  console.log('[beforeEach 2]')
})

afterEach(() => {
  console.log('[afterEach 1]')
})
afterEach(() => {
  console.log('[afterEach 2]')
})

test('test', async () => {
  console.log('[test 1]')
  console.log('[test 2]')
  await Promise.resolve()
  console.log('[test 3]')
  console.log('[test 4]')
})
