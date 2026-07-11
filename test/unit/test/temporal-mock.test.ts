import { afterEach, describe, expect, it, vi } from 'vitest'

// use polyfill for node < 26
if (!globalThis.Temporal) {
  await import('temporal-polyfill/global')
}

describe('testing Temporal mock functionality', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('setting time', () => {
    const date = new Date(2000, 0, 1)
    vi.setSystemTime(date)

    expect(Temporal.Now.instant().epochMilliseconds).toEqual(date.getTime())
    expect(Temporal.Now.zonedDateTimeISO().epochMilliseconds).toEqual(date.getTime())
    expect(Temporal.Now.plainDateISO()).toEqual(Temporal.PlainDate.from('2000-01-01'))
    expect(Temporal.Now.plainDateTimeISO()).toEqual(Temporal.PlainDateTime.from('2000-01-01T00:00:00'))
    expect(Temporal.Now.plainTimeISO()).toEqual(Temporal.PlainTime.from('00:00:00'))

    vi.useRealTimers()

    expect(Temporal.Now.instant().epochMilliseconds).not.toEqual(date.getTime())
    expect(Temporal.Now.zonedDateTimeISO().epochMilliseconds).not.toEqual(date.getTime())
    expect(Temporal.Now.plainDateISO()).not.toEqual(Temporal.PlainDate.from('2000-01-01'))
    expect(Temporal.Now.plainDateTimeISO()).not.toEqual(Temporal.PlainDateTime.from('2000-01-01T00:00:00'))
    expect(Temporal.Now.plainTimeISO()).not.toEqual(Temporal.PlainTime.from('00:00:00'))
  })

  it('getting current date in the specific time zone', () => {
    vi.setSystemTime(new Date('2000-01-01T00:00:00Z'))

    const timeZone = 'America/Los_Angeles'
    const timeZoneLike = new Temporal.ZonedDateTime(0n, timeZone)

    for (const tz of [timeZone, timeZoneLike]) {
      expect(Temporal.Now.zonedDateTimeISO(tz)).toEqual(
        Temporal.ZonedDateTime.from('1999-12-31T16:00:00-08:00[America/Los_Angeles]'),
      )
      expect(Temporal.Now.plainDateISO(tz)).toEqual(Temporal.PlainDate.from('1999-12-31'))
      expect(Temporal.Now.plainDateTimeISO(tz)).toEqual(Temporal.PlainDateTime.from('1999-12-31T16:00:00'))
      expect(Temporal.Now.plainTimeISO(tz)).toEqual(Temporal.PlainTime.from('16:00:00'))
    }
  })
})
