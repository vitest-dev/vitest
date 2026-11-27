import { createRandomSource, deriveSeed } from '@vitest/utils/random-source'
import { expect, test } from 'vitest'
import { getSeededStartTime, toTimeRange } from '../../../packages/vitest/src/runtime/runner/fakes'

const seeds = Array.from({ length: 200 }, (_, index) => deriveSeed(['timers', String(index)]))
const DAY = 24 * 60 * 60 * 1000
const years = toTimeRange({
  min: new Date('2024-01-01T00:00:00.000Z'),
  max: new Date('2027-12-31T23:59:59.999Z'),
})

// a random source that returns these raw values, then zeros
function replay(values: number[]) {
  const random = createRandomSource(seeds[0])
  let index = 0
  random.uint32 = () => values[index++] ?? 0
  return random
}

test('a seed gives the same time inside the range, and the seeds reach the edges of months and days', () => {
  const startTime = (seed: string) => getSeededStartTime(createRandomSource(seed), years)
  const times = seeds.map(startTime)

  expect(seeds.map(startTime)).toEqual(times)
  expect(new Set(times).size).toBe(seeds.length)
  for (const time of times) {
    expect(time).toBeGreaterThanOrEqual(years.min)
    expect(time).toBeLessThanOrEqual(years.max)
  }
  // edge cases that are rare with real dates
  const dates = times.map((time) => new Date(time))
  expect(times.some((time) => time % DAY === 0)).toBe(true)
  expect(times.some((time) => time % DAY === DAY - 1)).toBe(true)
  expect(dates.some((date) => new Date(date.valueOf() + DAY).getUTCDate() === 1)).toBe(true)
  expect(dates.some((date) => date.getUTCMonth() === 1)).toBe(true)
})

test('raw values of 0 give the start of the range, and edge values give its end and the last day of February', () => {
  const start = (values: number[]) =>
    new Date(getSeededStartTime(replay(values), years)).toISOString()
  const highest = 2 ** 32 - 1
  // the edge cases of `int(0, 11)` are January, February and December
  const february = 2 ** 32 - 2 ** 27

  // each of the 4 fields reads the raw value of its edge case, and then its integer
  expect(start([])).toBe('2024-01-01T00:00:00.000Z')
  expect(start([highest, 0, highest, 0, highest, 0, highest, 0])).toBe('2027-12-31T23:59:59.999Z')
  expect(start([0, 0, february, 0, highest, 0])).toBe('2024-02-29T00:00:00.000Z')
  expect(start([highest, 0, february, 0, highest, 0])).toBe('2027-02-28T00:00:00.000Z')
})

test('a range that starts and ends inside a day keeps the time inside the range', () => {
  const range = toTimeRange({
    min: new Date('2024-06-15T12:30:00.000Z'),
    max: new Date('2026-02-10T06:00:00.000Z'),
  })
  const times = seeds.map((seed) => getSeededStartTime(createRandomSource(seed), range))
  for (const time of times) {
    expect(time).toBeGreaterThanOrEqual(range.min)
    expect(time).toBeLessThanOrEqual(range.max)
  }
  // only the first day of the range starts at 12:30
  const afterFirstDay = times.filter((time) => time >= Date.UTC(2024, 5, 16))
  expect(afterFirstDay.some((time) => time % DAY < 12.5 * 60 * 60 * 1000)).toBe(true)

  const highest = 2 ** 32 - 1
  expect(getSeededStartTime(replay([]), range)).toBe(range.min)
  expect(getSeededStartTime(replay([highest, 0, highest, 0, highest, 0, highest, 0]), range)).toBe(
    range.max,
  )

  const time = Date.UTC(2031, 4, 6)
  expect(getSeededStartTime(createRandomSource(seeds[0]), { min: time, max: time })).toBe(time)
})

test('a range of strings from a config that was sent as JSON gives the same times as dates', () => {
  expect(toTimeRange({ min: '2024-01-01T00:00:00.000Z', max: '2027-12-31T23:59:59.999Z' })).toEqual(
    years,
  )
})
