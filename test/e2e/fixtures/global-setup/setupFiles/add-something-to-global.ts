import { afterAll, beforeAll, beforeEach } from 'vitest'

beforeAll(() => {
  // @ts-expect-error type
  globalThis.something = 'something'
})

beforeAll(async () => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, 300)
  })
})

beforeEach(async () => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, 10)
  })
})

afterAll(() => {
  // @ts-expect-error type
  delete globalThis.something
})

afterAll(async () => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, 500)
  })
})
