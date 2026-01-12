import { afterAll, beforeAll } from 'vitest'

beforeAll(() => {
  // @ts-expect-error type
  globalThis.loaded = true
})

afterAll(() => {
  // @ts-expect-error type
  delete globalThis.loaded
})
