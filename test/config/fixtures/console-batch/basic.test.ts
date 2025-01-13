import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from 'vitest'

beforeAll(() => {
  console.log('__TEST__ [beforeAll 1]')
})
beforeAll(() => {
  console.log('__TEST__ [beforeAll 2]')
})

afterAll(() => {
  console.log('__TEST__ [afterAll 1]')
})
afterAll(() => {
  console.log('__TEST__ [afterAll 2]')
})

beforeEach(() => {
  console.log('__TEST__ [beforeEach 1]')
})
beforeEach(() => {
  console.log('__TEST__ [beforeEach 2]')
})

afterEach(() => {
  console.log('__TEST__ [afterEach 1]')
})
afterEach(() => {
  console.log('__TEST__ [afterEach 2]')
})

test('test', async () => {
  console.log('__TEST__ [test 1]')
  console.log('__TEST__ [test 2]')
  await Promise.resolve()
  console.log('__TEST__ [test 3]')
  console.log('__TEST__ [test 4]')
})
