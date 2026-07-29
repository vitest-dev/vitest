import { test } from 'vitest'

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

test.concurrent('test1', async ({ expect }) => {
  expect.assertions(1)
  await delay(10).then(() => {
    expect(1).eq(1)
  })
})

test.concurrent('test2', async ({ expect }) => {
  expect.assertions(1)
  await delay(100).then(() => {
    expect(2).eq(2)
  })
})
