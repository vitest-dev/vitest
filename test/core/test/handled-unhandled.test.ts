import { nextTick } from 'node:process'
import { expect, test, vi } from 'vitest'

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
