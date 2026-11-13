import type { RandomSource } from '@vitest/utils/random-source'

// the fields of a @sinonjs/fake-timers timer that the schedule reads and changes
interface ScheduledTimer {
  id: number
  type: string
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

const FRAME_DURATION = 16
// the longest delay of a timer in Node.js and browsers
const MAX_JITTER = 2 ** 31 - 1

export function validateTimerSchedule(order: unknown, jitter: unknown): void {
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
  validateTimerSchedule(order, jitter)
  const shuffle = order === 'random'
  const maxDelay = typeof jitter === 'number' ? jitter : 0
  if (!shuffle && !maxDelay) {
    return undefined
  }
  if (!getRandom) {
    throw new Error('Fake timers with a random order or a jitter need a random source.')
  }
  const delays = new WeakMap<ScheduledTimer, number>()
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
        placeAmongTies(timer, ties, (other) => blocks(other, delay), random)
      }
      add(list, timer, clock)
      return
    }

    const list = kind === 'immediate' ? immediates : frames
    const last = list.findLast(-Infinity, Infinity, clock, () => true)
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
        placeAmongTies(
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
  }

  return {
    scheduleTimer,
    getNextFrameTime: () => (lastClock ? frames.findFirst(lastClock)?.callAt : undefined),
  }
}

// Timers that are due at the same time run in a random order, except that a timer always runs
// after the timers that block it.
function placeAmongTies(
  timer: ScheduledTimer,
  ties: ScheduledTimer[],
  blocks: (other: ScheduledTimer) => boolean,
  random: RandomSource,
): void {
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
