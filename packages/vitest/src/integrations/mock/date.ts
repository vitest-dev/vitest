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

export const RealDate = Date

let now: null | number = null

class MockDate extends RealDate {
  constructor()
  constructor(value: number | string)
  constructor(year: number, month: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number)
  constructor(y?: number | string, m?: number, d?: number, h?: number, M?: number, s?: number, ms?: number) {
    super()

    let date: any
    switch (arguments.length) {
      case 0:
        if (now !== null)
          date = new RealDate(now.valueOf())
        else
          date = new RealDate()
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

    return date
  }
}

// MockDate.prototype = RealDate.prototype

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
  if (isNaN(dateObj.getTime()))
    throw new TypeError(`mockdate: The time set is an invalid date: ${date}`)

  // @ts-expect-error global
  globalThis.Date = MockDate

  now = dateObj.valueOf()
}

export function resetDate(): void {
  globalThis.Date = RealDate
}
