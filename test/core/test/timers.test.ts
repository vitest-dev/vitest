/* eslint-disable @typescript-eslint/no-use-before-define */

import { vi, test, expect } from 'vitest'

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

  setTimeout(t, 1000)
  const timeout = setTimeout(t, 1000)
  clearTimeout(timeout)

  vi.runOnlyPendingTimers()
  vi.useRealTimers()

  expect(t).toBeCalledTimes(1)
})

test('advance timeout', () => {
  const t = vi.fn()

  vi.useFakeTimers()

  setTimeout(t, 1000)

  vi.advanceTimersByTime(500)

  expect(t).not.toBeCalled()

  vi.advanceTimersByTime(500)

  expect(t).toBeCalledTimes(1)

  vi.useRealTimers()
})

test('advance nested timeout', () => {
  const t600 = vi.fn()
  const t100 = vi.fn(() => {
    setTimeout(t600, 600)
  })
  const t50 = vi.fn(() => {
    setTimeout(t100, 100)
  })
  const t = vi.fn(() => {
    setTimeout(t50, 50)
  })

  vi.useFakeTimers()

  setTimeout(t, 0)

  vi.advanceTimersByTime(30)

  expect(t).toBeCalled()
  expect(t50).not.toBeCalled()

  vi.advanceTimersByTime(200)

  expect(t).toBeCalledTimes(1)
  expect(t50).toBeCalledTimes(1)
  expect(t100).toBeCalledTimes(1)

  expect(t600).not.toBeCalled()

  vi.advanceTimersByTime(519)

  expect(t600).not.toBeCalled()

  vi.advanceTimersByTime(1)

  expect(t600).toBeCalledTimes(1)
})

test('doesnt trigger twice', () => {
  const t = vi.fn()

  vi.useFakeTimers()

  setTimeout(t, 1000)

  vi.runOnlyPendingTimers()
  vi.runOnlyPendingTimers()
  vi.runAllTimers()

  expect(t).toBeCalledTimes(1)
})

test('timeout cyclic', async() => {
  const t = vi.fn(() => {
    setTimeout(t, 1000)
  })

  vi.useFakeTimers()

  setTimeout(t, 1000)

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

test.only('advance interval', () => {
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
