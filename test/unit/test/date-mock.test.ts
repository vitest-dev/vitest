import { afterEach, describe, expect, test, vi } from 'vitest'

describe('testing date mock functionality', () => {
  afterEach(() => {
    vi.useRealTimers()
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

  test('mocked system time also updates Temporal.Now', () => {
    const originalTemporal = (globalThis as any).Temporal
    const realNow = Date.now.bind(Date)

    ;(globalThis as any).Temporal = {
      Instant: {
        fromEpochMilliseconds: (epochMilliseconds: number) => ({
          epochMilliseconds,
          toZonedDateTimeISO: () => ({
            epochMilliseconds,
            toPlainDateTime: () => ({ epochMilliseconds }),
            toPlainDate: () => ({ epochMilliseconds }),
            toPlainTime: () => ({ epochMilliseconds }),
            toPlainYearMonth: () => ({ epochMilliseconds }),
            toPlainMonthDay: () => ({ epochMilliseconds }),
          }),
        }),
      },
      Now: {
        instant: () => ({ epochMilliseconds: realNow() }),
        plainDateTimeISO: () => ({ epochMilliseconds: realNow() }),
        plainDateISO: () => ({ epochMilliseconds: realNow() }),
        plainTimeISO: () => ({ epochMilliseconds: realNow() }),
        plainYearMonthISO: () => ({ epochMilliseconds: realNow() }),
        plainMonthDayISO: () => ({ epochMilliseconds: realNow() }),
        zonedDateTimeISO: () => ({ epochMilliseconds: realNow() }),
        timeZoneId: () => 'UTC',
      },
    }

    try {
      const date = new Date(2000, 1, 1)

      vi.setSystemTime(date)

      expect((globalThis as any).Temporal.Now.instant().epochMilliseconds).toBe(date.valueOf())
      expect((globalThis as any).Temporal.Now.plainDateTimeISO().epochMilliseconds).toBe(date.valueOf())
    }
    finally {
      ;(globalThis as any).Temporal = originalTemporal
    }
  })
})
