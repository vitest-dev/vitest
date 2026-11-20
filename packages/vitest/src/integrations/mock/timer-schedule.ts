import type { RandomSource } from '@vitest/utils/random-source'
import { getType } from '@vitest/utils/helpers'
import { recordRandomCall } from '@vitest/utils/random-tape'

// the fields of a @sinonjs/fake-timers timer that the schedule reads and changes
interface ScheduledTimer {
  id: number
  type: string
  func?: unknown
  delay?: number
  callAt: number
  order: number
  immediate?: boolean
  animation?: boolean
  requestIdleCallback?: boolean
}

interface ScheduleClock {
  now: number
  timers: Map<number, ScheduledTimer>
}

export interface TimerSchedule {
  scheduleTimer: (timer: ScheduledTimer, clock: ScheduleClock) => void
  getNextFrameTime: () => number | undefined
}

type TimerKind = 'timeout' | 'timed-idle' | 'immediate' | 'frame' | 'idle'

// what the schedule changed for 1 call of a timer
interface TimerChange {
  timer: ScheduledTimer
  kind: TimerKind
  // the time from the call to the run without the jitter, in milliseconds
  delay: number
  late: number
  // the timers that are due at the same time and now run after this timer
  passed: ScheduledTimer[]
  // the number of the call of an interval
  call: number | undefined
}

const FRAME_DURATION = 16
const MAX_LISTED_TIMERS = 3
// the longest delay of a timer in Node.js and browsers
const MAX_JITTER = 2 ** 31 - 1
const DAY = 24 * 60 * 60 * 1000

export interface TimeRange {
  min: number
  max: number
}

// 1 leap cycle: 2000 is a leap year only by the rule of 400 years, 2001 to 2003 are not leap years
const DEFAULT_START_RANGE: TimeRange = { min: Date.UTC(2000, 0, 1), max: Date.UTC(2004, 0, 1) - 1 }

// The start time from the seed, or `undefined` if the clock starts at a fixed `now` or the real time
export function getStartRange(now: unknown, hasSchedule: boolean): TimeRange | undefined {
  if (isTimeRange(now)) {
    return toTimeRange(now)
  }
  return hasSchedule && now === undefined ? DEFAULT_START_RANGE : undefined
}

// UTC fields give the same time in every time zone, and the edge cases of `int` give the first and
// the last month, day and millisecond. A field stays inside the range only while the fields
// before it are at the bound of the range
export function getSeededStartTime(random: RandomSource, range: TimeRange): number {
  return recordRandomCall(
    random,
    'vi.useFakeTimers',
    [],
    () => {
      const min = new Date(range.min)
      const max = new Date(range.max)
      const year = random.int(min.getUTCFullYear(), max.getUTCFullYear())
      let atMin = year === min.getUTCFullYear()
      let atMax = year === max.getUTCFullYear()
      const month = random.int(atMin ? min.getUTCMonth() : 0, atMax ? max.getUTCMonth() : 11)
      atMin &&= month === min.getUTCMonth()
      atMax &&= month === max.getUTCMonth()
      const monthStart = getUTCTime(year, month, 1)
      const days = (getUTCTime(year, month + 1, 1) - monthStart) / DAY
      const day = random.int(atMin ? min.getUTCDate() : 1, atMax ? max.getUTCDate() : days)
      atMin &&= day === min.getUTCDate()
      atMax &&= day === max.getUTCDate()
      const dayStart = monthStart + (day - 1) * DAY
      return (
        dayStart +
        random.int(atMin ? range.min - dayStart : 0, atMax ? range.max - dayStart : DAY - 1)
      )
    },
    (time) => `vi.useFakeTimers() starts at ${new Date(time).toISOString()}`,
  )
}

// `Date.UTC` reads the years 0 to 99 as 1900 to 1999
function getUTCTime(year: number, month: number, day: number): number {
  return new Date(0).setUTCFullYear(year, month, day)
}

export function isTimeRange(value: unknown): value is { min?: unknown; max?: unknown } {
  return typeof value === 'object' && value !== null && ('min' in value || 'max' in value)
}

function toTimeRange(range: { min?: unknown; max?: unknown }): TimeRange {
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

// a config that was sent as JSON has strings instead of dates
function toTime(value: unknown): number {
  if (typeof value === 'number' || typeof value === 'string') {
    return new Date(value).getTime()
  }
  return isDate(value) ? value.getTime() : Number.NaN
}

// the vm pools run tests in another realm than the config, so `instanceof Date` is false
function isDate(value: unknown): value is Date {
  return getType(value) === 'Date'
}

export function validateFakeTimers(
  config: { order?: unknown; jitter?: unknown; now?: unknown } | undefined,
): void {
  const { order, jitter, now } = config ?? {}
  if (isTimeRange(now)) {
    toTimeRange(now)
  }
  if (order !== undefined && order !== 'fifo' && order !== 'random') {
    throw new TypeError(
      `The "order" option of fake timers must be "fifo" or "random", received ${JSON.stringify(order)}.`,
    )
  }
  if (
    jitter !== undefined &&
    (typeof jitter !== 'number' || !Number.isInteger(jitter) || jitter < 0 || jitter > MAX_JITTER)
  ) {
    throw new TypeError(
      `The "jitter" option of fake timers must be an integer from 0 to ${MAX_JITTER}, received ${JSON.stringify(jitter)}.`,
    )
  }
}

export function createTimerSchedule(
  order: unknown,
  jitter: unknown,
  getRandom: (() => RandomSource) | undefined,
): TimerSchedule | undefined {
  const shuffle = order === 'random'
  const maxDelay = typeof jitter === 'number' ? jitter : 0
  if (!shuffle && !maxDelay) {
    return undefined
  }
  if (!getRandom) {
    throw new Error('Fake timers with a random order or a jitter need a random source.')
  }
  const delays = new WeakMap<ScheduledTimer, number>()
  const intervalCalls = new WeakMap<ScheduledTimer, number>()
  const lists = new WeakMap<ScheduledTimer, PendingTimers>()
  const timeouts = new PendingTimers()
  const timedIdleCallbacks = new PendingTimers()
  const immediates = new PendingTimers()
  const frames = new PendingTimers()
  let lastClock: ScheduleClock | undefined

  const blocks = (other: ScheduledTimer, delay: number) => (delays.get(other) ?? Infinity) <= delay
  const add = (list: PendingTimers, timer: ScheduledTimer, clock: ScheduleClock) => {
    list.add(timer, clock)
    lists.set(timer, list)
  }

  // returns the timers that are due at the same time and now run after this timer
  const placeTimer = (
    timer: ScheduledTimer,
    kind: Exclude<TimerKind, 'idle'>,
    clock: ScheduleClock,
    random: RandomSource,
  ): ScheduledTimer[] => {
    if (kind === 'timeout' || kind === 'timed-idle') {
      const list = kind === 'timeout' ? timeouts : timedIdleCallbacks
      const delay = timer.callAt - clock.now
      const callAt = timer.callAt + (maxDelay ? random.int(0, maxDelay) : 0)
      // a timer never runs before a timer that was created earlier with an equal or a smaller delay,
      // and that timer is at most `jitter` late
      const earlier = list.findLast(callAt, timer.callAt + maxDelay, clock, (other) =>
        blocks(other, delay),
      )
      timer.callAt = earlier?.callAt ?? callAt
      delays.set(timer, delay)
      let passed: ScheduledTimer[] = []
      if (shuffle && kind === 'timeout') {
        // only the timers after the last timer that blocks this one can change places with it
        const ties = timeouts.dueAt(timer.callAt, clock, (other) => blocks(other, delay))
        // all callbacks of a frame have the same order, so the frame is one place among the ties
        const [frame] = frames.dueAt(timer.callAt, clock, () => true)
        const blocker = ties.find((other) => blocks(other, delay))
        if (frame && (!blocker || frame.order > blocker.order)) {
          ties.push(frame)
          ties.sort((a, b) => a.order - b.order)
        }
        passed = placeAmongTies(timer, ties, (other) => blocks(other, delay), random)
      }
      add(list, timer, clock)
      return passed
    }

    const list = kind === 'immediate' ? immediates : frames
    const last = list.findLast(-Infinity, Infinity, clock, () => true)
    let passed: ScheduledTimer[] = []
    if (last && last.callAt >= timer.callAt) {
      // immediates and animation frames run in batches, so a new callback joins a batch that is late
      timer.callAt = last.callAt
      if (kind === 'frame') {
        // a browser runs all callbacks of a frame together, so no timeout can run between them
        timer.order = last.order
      }
    } else if (kind === 'frame') {
      // a late frame is late by whole frames
      const lateFrames = Math.floor(maxDelay / FRAME_DURATION)
      timer.callAt += lateFrames ? FRAME_DURATION * random.int(0, lateFrames) : 0
      if (shuffle) {
        passed = placeAmongTies(
          timer,
          timeouts.dueAt(timer.callAt, clock, () => false),
          () => false,
          random,
        )
      }
    } else if (maxDelay) {
      timer.callAt += random.int(0, maxDelay)
    }
    add(list, timer, clock)
    return passed
  }

  const scheduleTimer = (timer: ScheduledTimer, clock: ScheduleClock): void => {
    lastClock = clock
    const random = getRandom()
    // an interval that runs again or a timer that was refreshed
    lists.get(timer)?.remove(timer)
    const kind = getTimerKind(timer)

    if (kind === 'idle') {
      // idle callbacks run after all other timers, so they are never late
      return
    }
    let call: number | undefined
    if (timer.type === 'Interval') {
      call = (intervalCalls.get(timer) ?? 0) + 1
      intervalCalls.set(timer, call)
    }
    const [name, args] = getTimerCall(timer, kind)
    const callAt = timer.callAt
    recordRandomCall(
      random,
      name,
      args,
      (): TimerChange => {
        const passed = placeTimer(timer, kind, clock, random)
        return { timer, kind, delay: callAt - clock.now, late: timer.callAt - callAt, passed, call }
      },
      describeTimerChange,
    )
  }

  return {
    scheduleTimer,
    getNextFrameTime: () => (lastClock ? frames.findFirst(lastClock)?.callAt : undefined),
  }
}

// Timers that are due at the same time run in a random order, except that a timer always runs
// after the timers that block it. Returns the timers that now run after this timer.
function placeAmongTies(
  timer: ScheduledTimer,
  ties: ScheduledTimer[],
  blocks: (other: ScheduledTimer) => boolean,
  random: RandomSource,
): ScheduledTimer[] {
  let first = 0
  ties.forEach((other, index) => {
    if (blocks(other)) {
      first = index + 1
    }
  })
  // 0 keeps the order of creation
  const shift = ties.length > first ? random.int(0, ties.length - first) : 0
  if (shift) {
    const index = ties.length - shift
    const next = ties[index].order
    const previous = index > 0 ? ties[index - 1].order : next - 1
    timer.order = (previous + next) / 2
  }
  return ties.slice(ties.length - shift)
}

// the function that created the timer, as the test called it
function getTimerCall(timer: ScheduledTimer, kind: TimerKind): [name: string, args: unknown[]] {
  switch (kind) {
    case 'timeout':
      return [timer.type === 'Interval' ? 'setInterval' : 'setTimeout', [timer.func, timer.delay]]
    case 'timed-idle':
      return ['requestIdleCallback', [timer.func, { timeout: timer.delay }]]
    case 'idle':
      return ['requestIdleCallback', [timer.func]]
    case 'immediate':
      return ['setImmediate', [timer.func]]
    case 'frame':
      return ['requestAnimationFrame', [timer.func]]
  }
}

// for example "setTimeout(respond, 90) runs 10 ms late, after 100 ms"
function describeTimerChange({ timer, kind, delay, late, passed, call }: TimerChange): string {
  const parts: string[] = []
  if (late && kind === 'frame' && late % FRAME_DURATION === 0) {
    const frames = late / FRAME_DURATION
    parts.push(`${frames} ${frames === 1 ? 'frame' : 'frames'} (${late} ms) late`)
  } else if (late) {
    parts.push(delay > 0 ? `${late} ms late, after ${delay + late} ms` : `${late} ms late`)
  }
  if (passed.length) {
    parts.push(`before ${formatTimerList(passed)}`)
  }
  const runs = parts.length ? `runs ${parts.join(', and ')}` : 'runs on time'
  return `${formatTimerCall(timer, kind)}${call ? ` call ${call}` : ''} ${runs}`
}

function formatTimerList(timers: ScheduledTimer[]): string {
  const calls = timers
    .slice(0, MAX_LISTED_TIMERS)
    .map((timer) => formatTimerCall(timer, getTimerKind(timer)))
  const rest = timers.length - calls.length
  if (rest) {
    return `${calls.join(', ')} and ${rest} more`
  }
  return calls.length > 1 ? `${calls.slice(0, -1).join(', ')} and ${calls.at(-1)}` : calls[0]
}

function formatTimerCall(timer: ScheduledTimer, kind: TimerKind): string {
  const [name, args] = getTimerCall(timer, kind)
  const formattedArgs = args.map((arg) => {
    if (typeof arg === 'function') {
      return arg.name || 'callback'
    }
    if (typeof arg === 'object' && arg !== null && 'timeout' in arg) {
      return `{ timeout: ${arg.timeout} }`
    }
    return String(arg ?? 0)
  })
  return `${name}(${formattedArgs.join(', ')})`
}

// The timers of one kind, sorted like @sinonjs/fake-timers calls them. Timers that ran or were
// cleared stay in the list until it is cleaned, so each search skips them.
class PendingTimers {
  private timers: ScheduledTimer[] = []

  add(timer: ScheduledTimer, clock: ScheduleClock): void {
    if (this.timers.length > 2 * clock.timers.size + 32) {
      this.timers = this.timers.filter((other) => isPending(other, clock))
    }
    let low = 0
    let high = this.timers.length
    while (low < high) {
      const middle = (low + high) >>> 1
      const other = this.timers[middle]
      if (
        other.callAt < timer.callAt ||
        (other.callAt === timer.callAt && other.order <= timer.order)
      ) {
        low = middle + 1
      } else {
        high = middle
      }
    }
    this.timers.splice(low, 0, timer)
  }

  remove(timer: ScheduledTimer): void {
    const index = this.timers.indexOf(timer)
    if (index !== -1) {
      this.timers.splice(index, 1)
    }
  }

  // the pending timers that are due at the time, in the order of their calls,
  // from the last timer that matches `stop`
  dueAt(
    callAt: number,
    clock: ScheduleClock,
    stop: (timer: ScheduledTimer) => boolean,
  ): ScheduledTimer[] {
    const timers: ScheduledTimer[] = []
    for (let index = this.indexAfter(callAt) - 1; index >= 0; index--) {
      const timer = this.timers[index]
      if (timer.callAt !== callAt) {
        break
      }
      if (isPending(timer, clock)) {
        timers.push(timer)
        if (stop(timer)) {
          break
        }
      }
    }
    return timers.reverse()
  }

  // the last pending timer that is due after `from` and not after `to`, and matches
  findLast(
    from: number,
    to: number,
    clock: ScheduleClock,
    matches: (timer: ScheduledTimer) => boolean,
  ): ScheduledTimer | undefined {
    for (let index = this.indexAfter(to) - 1; index >= 0; index--) {
      const timer = this.timers[index]
      if (timer.callAt <= from) {
        return undefined
      }
      if (isPending(timer, clock) && matches(timer)) {
        return timer
      }
    }
    return undefined
  }

  findFirst(clock: ScheduleClock): ScheduledTimer | undefined {
    return this.timers.find((timer) => isPending(timer, clock))
  }

  // the index of the first timer that is due after the time
  private indexAfter(callAt: number): number {
    let low = 0
    let high = this.timers.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (this.timers[middle].callAt <= callAt) {
        low = middle + 1
      } else {
        high = middle
      }
    }
    return low
  }
}

function isPending(timer: ScheduledTimer, clock: ScheduleClock): boolean {
  return clock.timers.get(timer.id) === timer
}

function getTimerKind(timer: ScheduledTimer): TimerKind {
  if (timer.immediate) {
    return 'immediate'
  }
  if (timer.animation) {
    return 'frame'
  }
  if (timer.requestIdleCallback) {
    return timer.type === 'IdleCallback' ? 'idle' : 'timed-idle'
  }
  return 'timeout'
}
