import { nextTick } from 'node:process'
import { afterEach, describe, expect, test, vi } from 'vitest'

test('can test unhandled rejection', async () => {
  const fn = vi.fn()

  const promise = new Promise<void>((resolve) => {
    process.on('unhandledRejection', () => {
      fn()
      resolve()
    })
  })

  Promise.resolve().then(() => {
    throw new Error('unhandled rejection')
  })

  await promise

  expect(fn).toHaveBeenCalledTimes(1)
})

test('can test unhandled exception', async () => {
  const fn = vi.fn()

  const promise = new Promise<void>((resolve) => {
    process.on('uncaughtException', () => {
      fn()
      resolve()
    })
  })

  nextTick(() => {
    throw new Error('unhandled exception')
  })

  await promise

  expect(fn).toHaveBeenCalledTimes(1)
})

describe('with fake timers', () => {
  async function foo() {
    await new Promise(resolve => setTimeout(resolve, 100))
    throw new Error('boom')
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  test('rejects with `nextTimerAsync` tickMode', async () => {
    vi.useFakeTimers()
    vi.setTimerTickMode('nextTimerAsync')

    await expect(foo()).rejects.toThrow('boom')
  })

  test('rejects with proper order', async () => {
    vi.useFakeTimers()

    const assertion = expect(foo()).rejects.toThrow('boom')

    await vi.advanceTimersByTimeAsync(100)
    await assertion
  })
})
