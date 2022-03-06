import { afterAll, beforeAll } from 'vitest'

beforeAll(() => {
  // @ts-expect-error type
  global.something = 'something'
})

beforeAll(async() => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, 300)
  })
})

afterAll(() => {
  // @ts-expect-error type
  delete global.something
})

afterAll(async() => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, 500)
  })
})
