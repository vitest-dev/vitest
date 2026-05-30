import { Temporal as TemporalPolyfill } from 'temporal-polyfill'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

type TemporalGlobal = typeof globalThis & {
  Temporal?: typeof TemporalPolyfill
}

const RealTemporal = (globalThis as TemporalGlobal).Temporal
const realDateNow = Date.now.bind(Date)

function getTemporal() {
  return (globalThis as TemporalGlobal).Temporal!
}

function installNativeLikeTemporal() {
  if (RealTemporal) {
    return
  }

  const NativeLikeTemporal = Object.create(Object.getPrototypeOf(TemporalPolyfill))
  Object.defineProperties(
    NativeLikeTemporal,
    Object.getOwnPropertyDescriptors(TemporalPolyfill),
  )

  const nativeLikeNow = Object.create(Object.getPrototypeOf(TemporalPolyfill.Now))
  Object.defineProperties(
    nativeLikeNow,
    Object.getOwnPropertyDescriptors(TemporalPolyfill.Now),
  )

  function instant() {
    return TemporalPolyfill.Instant.fromEpochMilliseconds(realDateNow())
  }

  Object.defineProperties(nativeLikeNow, {
    instant: {
      value: instant,
      configurable: true,
    },
    zonedDateTimeISO: {
      value: (timeZone?: string) => {
        return instant().toZonedDateTimeISO(timeZone ?? TemporalPolyfill.Now.timeZoneId())
      },
      configurable: true,
    },
    plainDateTimeISO: {
      value: (timeZone?: string) => {
        return nativeLikeNow.zonedDateTimeISO(timeZone).toPlainDateTime()
      },
      configurable: true,
    },
    plainDateISO: {
      value: (timeZone?: string) => {
        return nativeLikeNow.zonedDateTimeISO(timeZone).toPlainDate()
      },
      configurable: true,
    },
    plainTimeISO: {
      value: (timeZone?: string) => {
        return nativeLikeNow.zonedDateTimeISO(timeZone).toPlainTime()
      },
      configurable: true,
    },
  })

  Object.defineProperty(NativeLikeTemporal, 'Now', {
    value: nativeLikeNow,
    writable: false,
    enumerable: false,
    configurable: true,
  })

  Object.defineProperty(globalThis, 'Temporal', {
    value: NativeLikeTemporal,
    writable: true,
    configurable: true,
  })
}

function restoreTemporal() {
  if (RealTemporal) {
    Object.defineProperty(globalThis, 'Temporal', {
      value: RealTemporal,
      writable: true,
      configurable: true,
    })
  }
  else {
    Reflect.deleteProperty(globalThis, 'Temporal')
  }
}

describe('testing date mock functionality', () => {
  beforeEach(() => {
    installNativeLikeTemporal()
  })

  afterEach(() => {
    vi.useRealTimers()
    restoreTemporal()
  })

  test('setting time in the past', () => {
    const date = new Date(2000, 1, 1)

    vi.setSystemTime(date)

    expect(Date.now()).toBe(date.valueOf())
    expect(vi.getMockedSystemTime()).toBe(date)

    vi.useRealTimers()

    expect(Date.now()).not.toBe(date.valueOf())
    expect(vi.getMockedSystemTime()).not.toBe(date)
  })

  test('setting time in different types', () => {
    const time = 1234567890

    vi.setSystemTime(time)

    expect(Date.now()).toBe(time)

    const timeStr = 'Fri Feb 20 2015 19:29:31 GMT+0530'
    const timeStrMs = 1424440771000

    vi.setSystemTime(timeStr)

    expect(Date.now()).toBe(timeStrMs)
  })

  test('date prototype is correct', () => {
    vi.setSystemTime(new Date(2000, 1, 1))

    expect(new Date()).toBeInstanceOf(Date)
  })

  test('mocks Temporal.Now without fake timers', () => {
    vi.setSystemTime(new Date(2026, 4, 14, 10, 20, 30, 40))

    expect(getTemporal().Now.instant().epochMilliseconds)
      .toBe(new Date(2026, 4, 14, 10, 20, 30, 40).valueOf())
    expect(getTemporal().Now.plainDateTimeISO().toString())
      .toMatchInlineSnapshot(`"2026-05-14T10:20:30.04"`)
  })

  test('mocks Temporal.Now with fake timers', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 14, 10, 20, 30, 40))

    expect(getTemporal().Now.instant().epochMilliseconds)
      .toBe(new Date(2026, 4, 14, 10, 20, 30, 40).valueOf())

    vi.advanceTimersByTime(1000)

    expect(getTemporal().Now.instant().epochMilliseconds)
      .toBe(new Date(2026, 4, 14, 10, 20, 31, 40).valueOf())
  })
})
