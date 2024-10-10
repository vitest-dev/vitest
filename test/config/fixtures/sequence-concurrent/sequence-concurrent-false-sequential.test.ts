import { describe, expect, test, vi } from 'vitest'

const delay = (timeout: number) => new Promise(resolve => setTimeout(resolve, timeout))

let count = 0

describe('sequential suite', () => {
  test('first test completes first', async ({ task }) => {
    await delay(40)
    expect(task.concurrent).toBeFalsy()
    expect(++count).toBe(1)
  })

  test('second test completes second', async ({ task }) => {
    await delay(30)
    expect(task.concurrent).toBeFalsy()
    expect(++count).toBe(2)
  })
})

test('third test completes third', async ({ task }) => {
  await delay(20)
  expect(task.concurrent).toBeFalsy()
  expect(++count).toBe(3)
})

test('last test completes last', async ({ task }) => {
  await delay(10)
  expect(task.concurrent).toBeFalsy()
  expect(++count).toBe(4)
})
