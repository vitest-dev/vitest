import { afterEach, expect, it, vi } from 'vitest'

// use polyfill for node < 26
if (!globalThis.Temporal) {
  await import('temporal-polyfill/global')
}

afterEach(() => {
  vi.useRealTimers()
})

it('Temporal.Now follows fake timers', () => {
  const real = globalThis.Temporal

  vi.useFakeTimers({ now: 0 })
  expect(globalThis.Temporal).not.toBe(real)
  expect(globalThis.Temporal.Now.instant().epochMilliseconds).toBe(0)

  vi.advanceTimersByTime(1234)
  expect(globalThis.Temporal.Now.instant().epochMilliseconds).toBe(1234)

  // restore
  vi.useRealTimers()
  expect(globalThis.Temporal).toBe(real)
  expect(globalThis.Temporal.Now.instant().epochMilliseconds).not.toBe(1234)
})

it('Temporal.Now follows setSystemTime without fake timers', () => {
  const real = globalThis.Temporal

  expect(vi.isFakeTimers()).toBe(false)
  vi.setSystemTime(0)
  expect(vi.isFakeTimers()).toBe(false)
  expect(globalThis.Temporal).not.toBe(real)
  expect(globalThis.Temporal.Now.instant().epochMilliseconds).toBe(0)

  vi.setSystemTime(1234)
  expect(vi.isFakeTimers()).toBe(false)
  expect(globalThis.Temporal.Now.instant().epochMilliseconds).toBe(1234)

  // restore
  vi.useRealTimers()
  expect(vi.isFakeTimers()).toBe(false)
  expect(globalThis.Temporal).toBe(real)
  expect(globalThis.Temporal.Now.instant().epochMilliseconds).not.toBe(1234)
})
