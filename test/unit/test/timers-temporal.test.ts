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

it('setSystemTime accepts Temporal.Instant', () => {
  vi.setSystemTime(globalThis.Temporal.Instant.from('2022-02-02T12:00:00Z'))
  expect(new Date().toISOString()).toBe('2022-02-02T12:00:00.000Z')
  expect(globalThis.Temporal.Now.instant().toString()).toBe('2022-02-02T12:00:00Z')

  vi.useFakeTimers()
  vi.setSystemTime(globalThis.Temporal.Instant.fromEpochMilliseconds(1234))
  expect(Date.now()).toBe(1234)
})

it('setSystemTime accepts Temporal.ZonedDateTime', () => {
  vi.setSystemTime(globalThis.Temporal.ZonedDateTime.from('2022-02-02T17:30:00+05:30[Asia/Kolkata]'))
  expect(new Date().toISOString()).toBe('2022-02-02T12:00:00.000Z')

  vi.useFakeTimers()
  vi.setSystemTime(globalThis.Temporal.ZonedDateTime.from('1970-01-01T05:30:01.234+05:30[Asia/Kolkata]'))
  expect(Date.now()).toBe(1234)
})

it('useFakeTimers accepts Temporal as now', () => {
  vi.useFakeTimers({ now: globalThis.Temporal.Instant.fromEpochMilliseconds(1234) })
  expect(Date.now()).toBe(1234)

  vi.useRealTimers()
  vi.useFakeTimers({ now: globalThis.Temporal.ZonedDateTime.from('2022-02-02T17:30:00+05:30[Asia/Kolkata]') })
  expect(new Date().toISOString()).toBe('2022-02-02T12:00:00.000Z')
})
