import { describe, expect, test } from 'vitest'

const delay = (timeout: number) => new Promise(resolve => setTimeout(resolve, timeout))

function assertSequential() {
  let count = 0

  test('first test completes first', async ({ task }) => {
    await delay(50)
    expect(task.concurrent).toBeFalsy()
    expect(++count).toBe(1)
  })

  test('second test completes second', ({ task }) => {
    expect(task.concurrent).toBeFalsy()
    expect(++count).toBe(2)
  })

  test.concurrent('third test completes fourth', async ({ task }) => {
    await delay(50)
    expect(task.concurrent).toBe(true)
    expect(++count).toBe(4)
  })

  test.concurrent('fourth test completes third', ({ task }) => {
    expect(task.concurrent).toBe(true)
    expect(++count).toBe(3)
  })
}

function assertConcurrent() {
  let count = 0

  test('first test completes second', async ({ task }) => {
    await delay(50)
    expect(task.concurrent).toBe(true)
    expect(++count).toBe(2)
  })

  test('second test completes first', ({ task }) => {
    expect(task.concurrent).toBe(true)
    expect(++count).toBe(1)
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
}

assertSequential()

describe.concurrent('describe.concurrent', () => {
  assertConcurrent()

  describe('describe', assertConcurrent)

  describe.sequential('describe.sequential', () => {
    assertSequential()

    describe('describe', assertSequential)

    describe.concurrent('describe.concurrent', assertConcurrent)
  })
})
