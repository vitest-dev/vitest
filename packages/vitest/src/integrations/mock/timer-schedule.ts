import type { RandomSource } from '@vitest/utils/random-source'

// the fields of a @sinonjs/fake-timers timer that the schedule reads and changes
interface ScheduledTimer {
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

type ScheduleTimer = (timer: ScheduledTimer, clock: ScheduleClock) => void

type TimerKind = 'timeout' | 'timed-idle' | 'immediate' | 'frame' | 'idle'

const FRAME_DURATION = 16
const FRAME_ORDER = 2 ** 50

export function createTimerSchedule(
  order: unknown,
  jitter: unknown,
  getRandom: (() => RandomSource) | undefined,
): ScheduleTimer | undefined {
  if (order !== undefined && order !== 'fifo' && order !== 'random') {
    throw new TypeError(
      `The "order" option of fake timers must be "fifo" or "random", received ${JSON.stringify(order)}.`,
    )
  }
  if (
    jitter !== undefined &&
    (typeof jitter !== 'number' || !Number.isInteger(jitter) || jitter < 0)
  ) {
    throw new TypeError(
      `The "jitter" option of fake timers must be a non-negative integer, received ${JSON.stringify(jitter)}.`,
    )
  }
  const maxDelay = jitter ?? 0
  if (order !== 'random' && !maxDelay) {
    return undefined
  }
  if (!getRandom) {
    throw new Error('Fake timers with a random order or a jitter need a random source.')
  }
  const shuffle = order === 'random'
  const delays = new WeakMap<ScheduledTimer, number>()

  return (timer, clock) => {
    const random = getRandom()
    const kind = getTimerKind(timer)
    const others = [...clock.timers.values()].filter(
      (other) => other !== timer && getTimerKind(other) === kind,
    )

    if (kind === 'timeout' || kind === 'timed-idle') {
      const delay = timer.callAt - clock.now
      let callAt = timer.callAt + (maxDelay ? random.int(0, maxDelay) : 0)
      // a timer never runs before a timer that was created earlier with an equal or a smaller delay
      for (const other of others) {
        if ((delays.get(other) ?? Infinity) <= delay && other.callAt > callAt) {
          callAt = other.callAt
        }
      }
      timer.callAt = callAt
      delays.set(timer, delay)
      if (shuffle && kind === 'timeout') {
        placeAmongTies(timer, others, delay, delays, random)
      }
      return
    }

    if (kind === 'frame') {
      // a browser runs all callbacks of a frame together, so no timeout that is due
      // at the same time can run between them
      timer.order += FRAME_ORDER
    }

    // immediates, animation frames and idle callbacks run in batches in the order of creation,
    // so a new callback joins a batch that is late
    let lastCallAt = -Infinity
    for (const other of others) {
      lastCallAt = Math.max(lastCallAt, other.callAt)
    }
    if (lastCallAt >= timer.callAt) {
      timer.callAt = lastCallAt
    } else if (kind === 'frame') {
      // a late frame is late by whole frames
      const frames = Math.floor(maxDelay / FRAME_DURATION)
      timer.callAt += frames ? FRAME_DURATION * random.int(0, frames) : 0
    } else if (maxDelay) {
      timer.callAt += random.int(0, maxDelay)
    }
  }
}

// Timers that are due at the same time run in a random order, except that a timer always runs
// after the timers that were created earlier with an equal or a smaller delay.
function placeAmongTies(
  timer: ScheduledTimer,
  others: ScheduledTimer[],
  delay: number,
  delays: WeakMap<ScheduledTimer, number>,
  random: RandomSource,
): void {
  const ties = others
    .filter((other) => other.callAt === timer.callAt)
    .sort((a, b) => a.order - b.order)
  let first = 0
  ties.forEach((other, index) => {
    if ((delays.get(other) ?? Infinity) <= delay) {
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
