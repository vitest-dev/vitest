import type {} from 'temporal-polyfill/types/global'
import { afterEach, expect, onTestFinished, test, vi } from 'vitest'

// use polyfill for node < 26
if (!globalThis.Temporal) {
  await import('temporal-polyfill/global')
}

afterEach(() => {
  vi.useRealTimers()
})

// what a module has if it keeps the functions when it loads
function keepTimers() {
  const {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Intl,
    Temporal,
    performance,
  } = globalThis
  return { setTimeout, clearTimeout, setInterval, clearInterval, Date, Intl, Temporal, performance }
}

test('kept timer functions use real timers after vi.useRealTimers()', async () => {
  vi.useFakeTimers()
  const kept = keepTimers()
  vi.useRealTimers()

  const timeout = vi.fn()
  kept.setTimeout(timeout, 1)
  const cleared = vi.fn()
  kept.clearTimeout(kept.setTimeout(cleared, 1))
  const interval = vi.fn()
  const id = kept.setInterval(interval, 1)

  await vi.waitFor(() => expect(interval.mock.calls.length).toBeGreaterThanOrEqual(2))
  kept.clearInterval(id)
  expect(timeout).toHaveBeenCalledOnce()
  expect(cleared).not.toHaveBeenCalled()
})

test('kept timer functions use the fake timers of the next vi.useFakeTimers()', () => {
  vi.useFakeTimers()
  const kept = keepTimers()
  vi.useRealTimers()
  vi.useFakeTimers()

  const timeout = vi.fn()
  kept.setTimeout(timeout, 100)
  const cleared = vi.fn()
  kept.clearTimeout(kept.setTimeout(cleared, 100))

  expect(vi.getTimerCount()).toBe(1)
  vi.advanceTimersByTime(100)
  expect(timeout).toHaveBeenCalledOnce()
  expect(cleared).not.toHaveBeenCalled()
})

test('a kept Date has the real time after vi.useRealTimers()', () => {
  vi.useFakeTimers({ now: new Date('2020-01-01T00:00:00.000Z') })
  const kept = keepTimers()
  vi.useRealTimers()

  const before = Date.now()
  expect(kept.Date.now()).toBeGreaterThanOrEqual(before)
  expect(new kept.Date().getTime()).toBeGreaterThanOrEqual(before)
  expect(kept.Temporal.Now.instant().epochMilliseconds).toBeGreaterThanOrEqual(before)
  expect(kept.performance.now()).toBeGreaterThan(0)
  expect(kept.performance.now()).toBeLessThanOrEqual(performance.now())
})

test('a kept Date has the time of the next vi.useFakeTimers()', () => {
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeZone: 'UTC' }
  vi.useFakeTimers({ now: new Date('2020-01-01T00:00:00.000Z') })
  const kept = keepTimers()
  const formatter = new kept.Intl.DateTimeFormat('en-US', options)
  vi.useRealTimers()

  const leapDay = new Date('2024-02-29T12:00:00.000Z')
  vi.useFakeTimers({ now: leapDay })
  expect(kept.Date.now()).toBe(leapDay.getTime())
  expect(new kept.Date().toISOString()).toBe('2024-02-29T12:00:00.000Z')
  expect(kept.Date()).toBe(leapDay.toString())
  expect(formatter.format()).toBe('2/29/24')
  expect(new kept.Intl.DateTimeFormat('en-US', options).format()).toBe('2/29/24')
  expect(kept.Temporal.Now.instant().epochMilliseconds).toBe(leapDay.getTime())

  const start = kept.performance.now()
  vi.advanceTimersByTime(1000)
  expect(kept.performance.now() - start).toBe(1000)
  expect(kept.Date.now()).toBe(leapDay.getTime() + 1000)
})

test('a spy on setTimeout that is restored after vi.useRealTimers() leaves real timers', async () => {
  const realSetTimeout = globalThis.setTimeout
  onTestFinished(() => {
    globalThis.setTimeout = realSetTimeout
  })

  vi.useFakeTimers()
  const spy = vi.spyOn(globalThis, 'setTimeout')
  vi.useRealTimers()
  // puts the fake function back
  spy.mockRestore()
  expect(globalThis.setTimeout).not.toBe(realSetTimeout)

  const timeout = vi.fn()
  setTimeout(timeout, 1)
  await vi.waitFor(() => expect(timeout).toHaveBeenCalledOnce())
})
