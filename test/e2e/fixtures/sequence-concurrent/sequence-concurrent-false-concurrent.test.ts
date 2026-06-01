import { describe, expect, test, vi } from 'vitest'

const delay = (timeout: number) => new Promise(resolve => setTimeout(resolve, timeout))

let count = 0

describe.concurrent('concurrent suite', () => {
  test('first test completes last', async ({ task }) => {
    await delay(40)
    expect(task.concurrent).toBeTruthy()
    expect(++count).toBe(4)
  })

  test('second test completes third', async ({ task }) => {
    await delay(30)
    expect(task.concurrent).toBeTruthy()
    expect(++count).toBe(3)
  })
})

test.concurrent('third test completes second', async ({ task }) => {
  await delay(20)
  expect(task.concurrent).toBeTruthy()
  expect(++count).toBe(2)
})

test.concurrent('last test completes first', async ({ task }) => {
  await delay(10)
  expect(task.concurrent).toBeTruthy()
  expect(++count).toBe(1)
})
