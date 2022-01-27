import { afterAll, beforeAll } from 'vitest'

beforeAll(() => {
  // @ts-expect-error type
  global.something = 'something'
})

afterAll(() => {
  // @ts-expect-error type
  delete global.something
})
