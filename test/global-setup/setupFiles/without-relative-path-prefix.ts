import { afterAll, beforeAll } from 'vitest'

beforeAll(() => {
  // @ts-expect-error type
  global.loaded = true
})

afterAll(() => {
  // @ts-expect-error type
  delete global.loaded
})
