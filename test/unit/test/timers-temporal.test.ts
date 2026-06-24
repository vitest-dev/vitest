import { afterEach, expect, it, vi } from 'vitest'
import 'temporal-polyfill/global'

// `@sinonjs/fake-timers` only mocks `Temporal` when it is present on the global
// object (natively available on Node.js >= 26). Importing `temporal-polyfill/global`
// installs it globally so this exercises the real mocking path on every supported
// runtime.

afterEach(() => {
  vi.useRealTimers()
})

it('Temporal.Now follows fake timers', () => {
  const real = globalThis.Temporal

  vi.useFakeTimers({ now: 0 })
  // fake-timers replaces the global `Temporal` with a clock-backed one
  expect(globalThis.Temporal).not.toBe(real)
  expect(globalThis.Temporal.Now.instant().epochMilliseconds).toBe(0)

  vi.advanceTimersByTime(1234)
  expect(globalThis.Temporal.Now.instant().epochMilliseconds).toBe(1234)

  vi.useRealTimers()
  // the original `Temporal` is restored
  expect(globalThis.Temporal).toBe(real)
  expect(globalThis.Temporal.Now.instant().epochMilliseconds).not.toBe(1234)
})
