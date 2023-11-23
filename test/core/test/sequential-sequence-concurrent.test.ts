import { describe, expect, test, vi } from 'vitest'

vi.setConfig({
  sequence: {
    concurrent: true,
  },
})

const delay = (timeout: number) => new Promise(resolve => setTimeout(resolve, timeout))

let count = 0

describe.sequential('running sequential suite when sequence.concurrent is true', () => {
  test('first test completes first', async ({ task }) => {
    await delay(50)
    expect(task.concurrent).toBeFalsy()
    expect(++count).toBe(1)
  })

  test('second test completes second', ({ task }) => {
    expect(task.concurrent).toBeFalsy()
    expect(++count).toBe(2)
  })
})

test.sequential('third test completes third', async ({ task }) => {
  await delay(50)
  expect(task.concurrent).toBeFalsy()
  expect(++count).toBe(3)
})

test.sequential('fourth test completes fourth', ({ task }) => {
  expect(task.concurrent).toBeFalsy()
  expect(++count).toBe(4)
})
