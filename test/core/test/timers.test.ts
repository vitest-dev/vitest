/* eslint-disable @typescript-eslint/no-use-before-define */

import { expect, test, vi } from 'vitest'
import { timeout } from '../src/timeout'

test('timers order: i -> t', () => {
  const res: string[] = []

  vi.useFakeTimers()

  const interval = setInterval(() => {
    res.push('interval')
    clearInterval(interval)
  })
  setTimeout(() => {
    res.push('timeout')
  })

  vi.runOnlyPendingTimers()
  vi.useRealTimers()

  expect(res).toEqual(['interval', 'timeout'])
})

test('timers order: t -> i', () => {
  const res: string[] = []

  vi.useFakeTimers()

  setTimeout(() => {
    res.push('timeout')
  })
  const interval = setInterval(() => {
    res.push('interval')
    clearInterval(interval)
  })

  vi.runOnlyPendingTimers()
  vi.useRealTimers()

  expect(res).toEqual(['timeout', 'interval'])
})

test('timeout', async() => {
  const t = vi.fn()

  vi.useFakeTimers()

  setTimeout(t, 50)
  const timeout = setTimeout(t, 50)
  clearTimeout(timeout)

  vi.runOnlyPendingTimers()
  vi.useRealTimers()

  expect(t).toBeCalledTimes(1)
})

test('advance timeout', () => {
  const t = vi.fn()

  vi.useFakeTimers()

  setTimeout(t, 50)

  vi.advanceTimersByTime(25)

  expect(t).not.toBeCalled()

  vi.advanceTimersByTime(25)

  expect(t).toBeCalledTimes(1)

  vi.useRealTimers()
})

test('advance nested timeout', () => {
  const t60 = vi.fn()
  const t10 = vi.fn(() => {
    setTimeout(t60, 60)
  })
  const t5 = vi.fn(() => {
    setTimeout(t10, 10)
  })
  const t = vi.fn(() => {
    setTimeout(t5, 5)
  })

  vi.useFakeTimers()

  setTimeout(t, 0)

  vi.advanceTimersByTime(3)

  expect(t).toBeCalled()
  expect(t5).not.toBeCalled()

  vi.advanceTimersByTime(20)

  expect(t).toBeCalledTimes(1)
  expect(t5).toBeCalledTimes(1)
  expect(t10).toBeCalledTimes(1)

  expect(t60).not.toBeCalled()

  vi.advanceTimersByTime(51)

  expect(t60).not.toBeCalled()

  vi.advanceTimersByTime(1)

  expect(t60).toBeCalledTimes(1)
})

test('doesnt trigger twice', () => {
  const t = vi.fn()

  vi.useFakeTimers()

  setTimeout(t, timeout)

  vi.runOnlyPendingTimers()
  vi.runOnlyPendingTimers()
  vi.runAllTimers()

  expect(t).toBeCalledTimes(1)
})

test.skip('timeout cyclic', async() => {
  const t = vi.fn(() => {
    setTimeout(t, timeout)
  })

  vi.useFakeTimers()

  setTimeout(t, timeout)

  expect(() => {
    vi.runAllTimers()
  }).toThrow('called 10 000 times')

  vi.useRealTimers()
})

test('interval', () => {
  let count = 0
  const i = vi.fn(() => {
    if (count === 20) clearInterval(interval)
    count++
  })

  vi.useFakeTimers()

  let interval = setInterval(i, 30)

  vi.runAllTimers()

  expect(i).toBeCalledTimes(21)
})

test('interval only pending', () => {
  let count = 0
  const p = vi.fn()
  const i = vi.fn(() => {
    setInterval(p, 50)
    if (count === 3) clearInterval(interval)
    count++
  })

  vi.useFakeTimers()

  let interval = setInterval(i, 30)

  vi.runOnlyPendingTimers()

  expect(i).toBeCalledTimes(4)
  expect(p).not.toBeCalled()
})

test('advance interval', () => {
  let count = 0
  const p = vi.fn()
  const i = vi.fn(() => {
    setInterval(p, 50)
    if (count === 3) clearInterval(interval)
    count++
  })

  vi.useFakeTimers()

  let interval = setInterval(i, 30)

  vi.advanceTimersByTime(100)

  expect(i).toBeCalledTimes(3)
  expect(p).toBeCalledTimes(1)

  vi.advanceTimersByTime(100)

  expect(i).toBeCalledTimes(4)
  expect(p).toBeCalledTimes(8)

  vi.useRealTimers()
})

test('async timer', async() => {
  const res: string[] = []

  vi.useFakeTimers()

  setTimeout(async() => {
    await Promise.resolve()
    res.push('item1')
  }, 100)

  setTimeout(async() => {
    await Promise.resolve()
    res.push('item2')
  }, 100)

  await vi.runAllTimers()
  vi.useRealTimers()

  expect(res).toEqual(['item1', 'item2'])
})

test('advance timer', async() => {
  const a1 = vi.fn()
  const a2 = vi.fn()

  vi.useFakeTimers()

  setTimeout(a1)
  setInterval(a2)

  vi.advanceTimersToNextTimer()

  expect(a1).toHaveBeenCalled()
  expect(a2).not.toHaveBeenCalled()

  vi.advanceTimersToNextTimer()

  expect(a2).toHaveBeenCalled()

  vi.advanceTimersToNextTimer()

  expect(a2).toHaveBeenCalledTimes(2)

  vi.useRealTimers()
})
