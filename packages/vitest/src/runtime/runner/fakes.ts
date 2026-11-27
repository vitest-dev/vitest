import type { RandomSource } from '@vitest/utils/random-source'
import type { Suite, Test, TestOptions } from './types'
import { getType } from '@vitest/utils/helpers'

type FakeTimersOptions = Exclude<TestOptions['fakeTimers'], boolean | undefined>

export interface TestFakes {
  timers?: FakeTimersOptions
  random?: boolean
}

interface TimeRange {
  min: number
  max: number
}

const DAY = 24 * 60 * 60 * 1000
const EDGE_CASES = { edgeCases: true }

// the options are not on the task, because the task is sent to the main process and the options
// can hold dates
const testFakes = new WeakMap<Test, TestFakes>()

export function getTestFakes(test: Test): TestFakes | undefined {
  return testFakes.get(test)
}

const restores = new WeakMap<Test, () => void>()

// the runner that installs the fakes of an attempt gives the function that removes them
export function setTestFakesRestore(test: Test, restore: () => void): void {
  restores.set(test, restore)
}

export function restoreTestFakes(test: Test): void {
  const restore = restores.get(test)
  restores.delete(test)
  restore?.()
}

export function setTestFakes(test: Test, options: TestOptions): void {
  const { fakeTimers, fakeRandom } = options
  if (fakeTimers != null && typeof fakeTimers !== 'boolean' && getType(fakeTimers) !== 'Object') {
    throw new TypeError(
      `The "fakeTimers" option of a test must be a boolean or an object with the options of fake timers, received ${JSON.stringify(fakeTimers)}.`,
    )
  }
  if (fakeRandom != null && typeof fakeRandom !== 'boolean') {
    throw new TypeError(
      `The "fakeRandom" option of a test must be a boolean, received ${JSON.stringify(fakeRandom)}.`,
    )
  }
  const timers = fakeTimers === true ? {} : fakeTimers || undefined
  if (timers && isTimeRange(timers.now)) {
    toTimeRange(timers.now)
  }
  if (timers && isConcurrent(test)) {
    throw new Error(
      `The "fakeTimers" option cannot be used in the concurrent test "${test.fullTestName}", because tests that run at the same time share 1 clock. Set \`concurrent: false\` on the test and on its suites.`,
    )
  }
  if (fakeRandom && isConcurrent(test)) {
    throw new Error(
      `The "fakeRandom" option cannot be used in the concurrent test "${test.fullTestName}", because tests that run at the same time share the random functions. Use \`context.random\` instead, or set \`concurrent: false\` on the test and on its suites.`,
    )
  }
  if (timers || fakeRandom != null) {
    testFakes.set(test, { timers, random: fakeRandom })
  }
}

// a concurrent suite runs at the same time as the suites next to it, also if the test is not concurrent
function isConcurrent(test: Test): boolean {
  if (test.concurrent) {
    return true
  }
  let suite: Suite | undefined = test.suite
  while (suite) {
    if (suite.concurrent) {
      return true
    }
    suite = suite.suite
  }
  return false
}

export function isTimeRange(value: unknown): value is { min?: unknown; max?: unknown } {
  return typeof value === 'object' && value !== null && ('min' in value || 'max' in value)
}

export function toTimeRange(range: { min?: unknown; max?: unknown }): TimeRange {
  const min = toTime(range.min)
  const max = toTime(range.max)
  if (Number.isNaN(min) || Number.isNaN(max)) {
    throw new TypeError(
      `The "now" range of fake timers must have a "min" and a "max" time, received ${JSON.stringify(range)}.`,
    )
  }
  if (min > max) {
    throw new TypeError(
      `The "now" range of fake timers must not have a "min" time after its "max" time, received ${JSON.stringify(range)}.`,
    )
  }
  return { min, max }
}

// a tag from a config that was sent as JSON has strings instead of dates
function toTime(value: unknown): number {
  if (typeof value === 'number' || typeof value === 'string') {
    return new Date(value).getTime()
  }
  // the vm pools run tests in another realm than the config, so `instanceof Date` is false
  return getType(value) === 'Date' ? (value as Date).getTime() : Number.NaN
}

// `Date.UTC` reads the years 0 to 99 as 1900 to 1999
function getUTCTime(year: number, month: number, day: number): number {
  return new Date(0).setUTCFullYear(year, month, day)
}

// UTC fields give the same time in every time zone, and the edge cases of `int` give the first and
// the last month, day and millisecond. A field stays inside the range only while the fields
// before it are at the bound of the range
export function getSeededStartTime(random: RandomSource, range: TimeRange): number {
  const min = new Date(range.min)
  const max = new Date(range.max)
  const year = random.int(min.getUTCFullYear(), max.getUTCFullYear(), EDGE_CASES)
  let atMin = year === min.getUTCFullYear()
  let atMax = year === max.getUTCFullYear()
  const month = random.int(
    atMin ? min.getUTCMonth() : 0,
    atMax ? max.getUTCMonth() : 11,
    EDGE_CASES,
  )
  atMin &&= month === min.getUTCMonth()
  atMax &&= month === max.getUTCMonth()
  const monthStart = getUTCTime(year, month, 1)
  const days = (getUTCTime(year, month + 1, 1) - monthStart) / DAY
  const day = random.int(atMin ? min.getUTCDate() : 1, atMax ? max.getUTCDate() : days, EDGE_CASES)
  atMin &&= day === min.getUTCDate()
  atMax &&= day === max.getUTCDate()
  const dayStart = monthStart + (day - 1) * DAY
  return (
    dayStart +
    random.int(atMin ? range.min - dayStart : 0, atMax ? range.max - dayStart : DAY - 1, EDGE_CASES)
  )
}
