import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from 'vitest'

beforeAll(() => {
  console.log('[beforeAll]')
})

afterAll(() => {
  console.log('[afterAll]')
})

beforeEach(() => {
  console.log('[beforeEach]')
})

afterEach(() => {
  console.log('[afterEach]')
})

test('test', async () => {
  console.log('a')
  console.log('b')
  await Promise.resolve()
  console.log('c')
  console.log('d')
})
