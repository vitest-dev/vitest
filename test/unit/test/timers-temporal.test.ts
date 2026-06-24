import { afterEach, expect, it, vi } from 'vitest'

// use polyfill for node < 26
if (typeof Temporal === 'undefined') {
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
