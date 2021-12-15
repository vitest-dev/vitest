/* eslint-disable @typescript-eslint/no-use-before-define */

import { vitest, test, expect } from 'vitest'

test('timers order: i -> t', () => {
  const res: string[] = []

  vitest.useFakeTimers()

  const interval = setInterval(() => {
    res.push('interval')
    clearInterval(interval)
  })
  setTimeout(() => {
    res.push('timeout')
  })

  vitest.runOnlyPendingTimers()
  vitest.useRealTimers()

  expect(res).toEqual(['interval', 'timeout'])
})

test('timers order: t -> i', () => {
  const res: string[] = []

  vitest.useFakeTimers()

  setTimeout(() => {
    res.push('timeout')
  })
  const interval = setInterval(() => {
    res.push('interval')
    clearInterval(interval)
  })

  vitest.runOnlyPendingTimers()
  vitest.useRealTimers()

  expect(res).toEqual(['timeout', 'interval'])
})

test('timeout', async() => {
  const t = vitest.fn()

  vitest.useFakeTimers()

  setTimeout(t, 1000)
  const timeout = setTimeout(t, 1000)
  clearTimeout(timeout)

  vitest.runOnlyPendingTimers()
  vitest.useRealTimers()

  expect(t).toBeCalledTimes(1)
})

test('advance timeout', () => {
  const t = vitest.fn()

  vitest.useFakeTimers()

  setTimeout(t, 1000)

  vitest.advanceTimersByTime(500)

  expect(t).not.toBeCalled()

  vitest.advanceTimersByTime(500)

  expect(t).toBeCalledTimes(1)

  vitest.useRealTimers()
})

test('advance nested timeout', () => {
  const t600 = vitest.fn()
  const t100 = vitest.fn(() => {
    setTimeout(t600, 600)
  })
  const t50 = vitest.fn(() => {
    setTimeout(t100, 100)
  })
  const t = vitest.fn(() => {
    setTimeout(t50, 50)
  })

  vitest.useFakeTimers()

  setTimeout(t, 0)

  vitest.advanceTimersByTime(30)

  expect(t).toBeCalled()
  expect(t50).not.toBeCalled()

  vitest.advanceTimersByTime(200)

  expect(t).toBeCalledTimes(1)
  expect(t50).toBeCalledTimes(1)
  expect(t100).toBeCalledTimes(1)

  expect(t600).not.toBeCalled()

  vitest.advanceTimersByTime(519)

  expect(t600).not.toBeCalled()

  vitest.advanceTimersByTime(1)

  expect(t600).toBeCalledTimes(1)
})

test('doesnt trigger twice', () => {
  const t = vitest.fn()

  vitest.useFakeTimers()

  setTimeout(t, 1000)

  vitest.runOnlyPendingTimers()
  vitest.runOnlyPendingTimers()
  vitest.runAllTimers()

  expect(t).toBeCalledTimes(1)
})

test('timeout cyclic', async() => {
  const t = vitest.fn(() => {
    setTimeout(t, 1000)
  })

  vitest.useFakeTimers()

  setTimeout(t, 1000)

  expect(() => {
    vitest.runAllTimers()
  }).toThrow('called 10 000 times')

  vitest.useRealTimers()
})

test('interval', () => {
  let count = 0
  const i = vitest.fn(() => {
    if (count === 20) clearInterval(interval)
    count++
  })

  vitest.useFakeTimers()

  let interval = setInterval(i, 30)

  vitest.runAllTimers()

  expect(i).toBeCalledTimes(21)
})

test('interval only pending', () => {
  let count = 0
  const p = vitest.fn()
  const i = vitest.fn(() => {
    setInterval(p, 50)
    if (count === 3) clearInterval(interval)
    count++
  })

  vitest.useFakeTimers()

  let interval = setInterval(i, 30)

  vitest.runOnlyPendingTimers()

  expect(i).toBeCalledTimes(4)
  expect(p).not.toBeCalled()
})

test.only('advance interval', () => {
  let count = 0
  const p = vitest.fn()
  const i = vitest.fn(() => {
    setInterval(p, 50)
    if (count === 3) clearInterval(interval)
    count++
  })

  vitest.useFakeTimers()

  let interval = setInterval(i, 30)

  vitest.advanceTimersByTime(100)

  expect(i).toBeCalledTimes(3)
  expect(p).toBeCalledTimes(1)

  vitest.advanceTimersByTime(100)

  expect(i).toBeCalledTimes(4)
  expect(p).toBeCalledTimes(8)

  vitest.useRealTimers()
})
