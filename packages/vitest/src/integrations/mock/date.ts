/* Ported from https://github.com/boblauer/MockDate/blob/master/src/mockdate.ts */
/*
The MIT License (MIT)

Copyright (c) 2014 Bob Lauer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

export const RealDate: DateConstructor = Date

let now: null | number = null
type TemporalNowMethod = 'instant' | 'plainDateTimeISO' | 'plainDateISO' | 'plainTimeISO' | 'plainYearMonthISO' | 'plainMonthDayISO' | 'zonedDateTimeISO'

const temporalNowMethods: TemporalNowMethod[] = [
  'instant',
  'plainDateTimeISO',
  'plainDateISO',
  'plainTimeISO',
  'plainYearMonthISO',
  'plainMonthDayISO',
  'zonedDateTimeISO',
]

let originalTemporalNowDescriptors: Partial<Record<TemporalNowMethod, PropertyDescriptor | undefined>> | null = null
let originalTemporalTimeZoneIdDescriptor: PropertyDescriptor | undefined

function getTemporal(): any {
  return (globalThis as any).Temporal as any
}

function getTemporalNowInstant(): any {
  const Temporal = getTemporal()
  return Temporal.Instant.fromEpochMilliseconds(Date.now())
}

function getTemporalNowZonedDateTimeISO(timeZone = getTemporal().Now.timeZoneId()): any {
  return getTemporalNowInstant().toZonedDateTimeISO(timeZone)
}

function patchTemporalNow(): void {
  const Temporal = getTemporal()
  if (!Temporal?.Now) {
    return
  }

  if (!originalTemporalNowDescriptors) {
    originalTemporalNowDescriptors = {}
    for (const method of temporalNowMethods) {
      originalTemporalNowDescriptors[method] = Object.getOwnPropertyDescriptor(Temporal.Now, method)
    }
    originalTemporalTimeZoneIdDescriptor = Object.getOwnPropertyDescriptor(Temporal.Now, 'timeZoneId')
  }

  Object.defineProperty(Temporal.Now, 'instant', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: () => getTemporalNowInstant(),
  })
  Object.defineProperty(Temporal.Now, 'plainDateTimeISO', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: (timeZone?: string) => getTemporalNowZonedDateTimeISO(timeZone).toPlainDateTime(),
  })
  Object.defineProperty(Temporal.Now, 'plainDateISO', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: (timeZone?: string) => getTemporalNowZonedDateTimeISO(timeZone).toPlainDate(),
  })
  Object.defineProperty(Temporal.Now, 'plainTimeISO', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: (timeZone?: string) => getTemporalNowZonedDateTimeISO(timeZone).toPlainTime(),
  })
  Object.defineProperty(Temporal.Now, 'plainYearMonthISO', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: (timeZone?: string) => getTemporalNowZonedDateTimeISO(timeZone).toPlainYearMonth(),
  })
  Object.defineProperty(Temporal.Now, 'plainMonthDayISO', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: (timeZone?: string) => getTemporalNowZonedDateTimeISO(timeZone).toPlainMonthDay(),
  })
  Object.defineProperty(Temporal.Now, 'zonedDateTimeISO', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: (timeZone?: string) => getTemporalNowZonedDateTimeISO(timeZone),
  })
}

function restoreTemporalNow(): void {
  const Temporal = getTemporal()
  if (!Temporal?.Now || !originalTemporalNowDescriptors) {
    return
  }

  for (const method of temporalNowMethods) {
    const descriptor = originalTemporalNowDescriptors[method]
    if (descriptor) {
      Object.defineProperty(Temporal.Now, method, descriptor)
    }
    else {
      Reflect.deleteProperty(Temporal.Now, method)
    }
  }

  if (originalTemporalTimeZoneIdDescriptor) {
    Object.defineProperty(Temporal.Now, 'timeZoneId', originalTemporalTimeZoneIdDescriptor)
  }

  originalTemporalNowDescriptors = null
  originalTemporalTimeZoneIdDescriptor = undefined
}

class MockDate extends RealDate {
  constructor()
  constructor(value: number | string)
  constructor(
    year: number,
    month: number,
    date?: number,
    hours?: number,
    minutes?: number,
    seconds?: number,
    ms?: number
  )
  constructor(
    y?: number | string,
    m?: number,
    d?: number,
    h?: number,
    M?: number,
    s?: number,
    ms?: number,
  ) {
    super()

    let date: any
    switch (arguments.length) {
      case 0:
        if (now !== null) {
          date = new RealDate(now.valueOf())
        }
        else {
          date = new RealDate()
        }
        break
      case 1:
        date = new RealDate(y!)
        break
      default:
        d = typeof d === 'undefined' ? 1 : d
        h = h || 0
        M = M || 0
        s = s || 0
        ms = ms || 0
        date = new RealDate(y as number, m!, d, h, M, s, ms)
        break
    }

    Object.setPrototypeOf(date, MockDate.prototype)

    return date
  }
}

MockDate.UTC = RealDate.UTC

MockDate.now = function () {
  return new MockDate().valueOf()
}

MockDate.parse = function (dateString) {
  return RealDate.parse(dateString)
}

MockDate.toString = function () {
  return RealDate.toString()
}

export function mockDate(date: string | number | Date): void {
  const dateObj = new RealDate(date.valueOf())
  if (Number.isNaN(dateObj.getTime())) {
    throw new TypeError(`mockdate: The time set is an invalid date: ${date}`)
  }

  // @ts-expect-error global
  globalThis.Date = MockDate
  patchTemporalNow()

  now = dateObj.valueOf()
}

export function resetDate(): void {
  globalThis.Date = RealDate
  restoreTemporalNow()
}

export function mockTemporalNow(): void {
  patchTemporalNow()
}

export function resetTemporalNow(): void {
  restoreTemporalNow()
}
