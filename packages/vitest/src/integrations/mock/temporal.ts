let now: number | undefined

let RealTemporal: typeof Temporal | undefined
let MockedTemporal: typeof Temporal | undefined

function currentZonedDateTime(
  RealTemporal: typeof Temporal,
  currentTime: number,
  timeZoneLike: any,
): Temporal.ZonedDateTime {
  const timeZone = timeZoneLike === undefined ? RealTemporal.Now.timeZoneId() : timeZoneLike
  return RealTemporal.Instant.fromEpochMilliseconds(currentTime).toZonedDateTimeISO(timeZone)
}

function createMockedTemporal(RealTemporal: typeof Temporal): typeof Temporal {
  const propertyDescriptors = Object.getOwnPropertyDescriptors(RealTemporal)
  propertyDescriptors.Now.value = {
    timeZoneId: RealTemporal.Now.timeZoneId,
    instant() {
      if (now !== undefined) {
        return RealTemporal.Instant.fromEpochMilliseconds(now)
      }
      return RealTemporal.Now.instant()
    },
    zonedDateTimeISO(timeZoneLike?: any) {
      if (now !== undefined) {
        return currentZonedDateTime(RealTemporal, now, timeZoneLike)
      }
      return RealTemporal.Now.zonedDateTimeISO(timeZoneLike)
    },
    plainDateTimeISO(timeZoneLike?: any) {
      if (now !== undefined) {
        return currentZonedDateTime(RealTemporal, now, timeZoneLike).toPlainDateTime()
      }
      return RealTemporal.Now.plainDateTimeISO(timeZoneLike)
    },
    plainDateISO(timeZoneLike?: any) {
      if (now !== undefined) {
        return currentZonedDateTime(RealTemporal, now, timeZoneLike).toPlainDate()
      }
      return RealTemporal.Now.plainDateISO(timeZoneLike)
    },
    plainTimeISO(timeZoneLike?: any) {
      if (now !== undefined) {
        return currentZonedDateTime(RealTemporal, now, timeZoneLike).toPlainTime()
      }
      return RealTemporal.Now.plainTimeISO(timeZoneLike)
    },
    [Symbol.toStringTag]: 'Temporal.Now',
  }
  const MockedTemporal = {} as typeof Temporal
  Object.defineProperties(MockedTemporal, propertyDescriptors)
  return MockedTemporal
}

export function mockTemporal(date: Date): void {
  now = date.valueOf()
  RealTemporal = globalThis.Temporal as typeof Temporal | undefined
  if (RealTemporal !== undefined) {
    MockedTemporal ??= createMockedTemporal(RealTemporal)
    globalThis.Temporal = MockedTemporal
  }
}

export function resetTemporal(): void {
  now = undefined
  if (RealTemporal !== undefined) {
    globalThis.Temporal = RealTemporal
  }
}
