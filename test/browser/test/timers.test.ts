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
  vi.useFakeTimers()

  console.time('fake-timers-zero')
  console.timeEnd('fake-timers-zero')

  console.time('fake-timers-advance')
  vi.advanceTimersByTime(1234)
  console.timeEnd('fake-timers-advance')
})
