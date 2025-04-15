/* eslint-disable no-console */
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})

it('only runs a setTimeout callback once (ever)', () => {
  vi.useFakeTimers()

  const fn = vi.fn()
  setTimeout(fn, 0)
  expect(fn).toHaveBeenCalledTimes(0)

  vi.runAllTimers()
  expect(fn).toHaveBeenCalledTimes(1)

  vi.runAllTimers()
  expect(fn).toHaveBeenCalledTimes(1)
})

it('console.time', async () => {
  vi.useFakeTimers({
    toFake: ['Date', 'performance'],
  })
  console.time('[console-time-fake]')
  await new Promise(r => setTimeout(r, 500))
  console.timeEnd('[console-time-fake]')
})
