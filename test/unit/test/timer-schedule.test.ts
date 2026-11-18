import type { RandomSource } from '@vitest/utils/random-source'
import type { FakeTimersConfig } from '../../../packages/vitest/src/integrations/mock/timers'
import { createRandomSource, deriveSeed } from '@vitest/utils/random-source'
import { expect, test } from 'vitest'
import { FakeTimers } from '../../../packages/vitest/src/integrations/mock/timers'

const seeds = Array.from({ length: 200 }, (_, index) => deriveSeed(['timers', String(index)]))

interface Simulation {
  global: typeof globalThis
  timers: FakeTimers
  record: (name: string) => () => void
}

// returns the name and the time of each callback, in the order of the calls
function simulate(
  config: FakeTimersConfig,
  seed: string,
  run: (simulation: Simulation) => void,
): string[] {
  // @sinonjs/fake-timers fakes only the functions that the global object has
  const global = Object.assign(Object.create(null), {
    Date,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    setImmediate,
    clearImmediate,
    requestAnimationFrame: setTimeout,
    cancelAnimationFrame: clearTimeout,
    requestIdleCallback: setTimeout,
    cancelIdleCallback: clearTimeout,
  })
  const random = createRandomSource(seed)
  const timers = new FakeTimers({ global, config: { now: 0, ...config }, getRandom: () => random })
  const calls: string[] = []
  timers.useFakeTimers()
  try {
    run({
      global,
      timers,
      record: (name) => () => calls.push(`${name} ${global.Date.now()}`),
    })
  } finally {
    timers.useRealTimers()
  }
  return calls
}

function timeoutsAtTheSameTime(config: FakeTimersConfig, seed: string) {
  return simulate(config, seed, ({ global, timers, record }) => {
    global.setTimeout(record('poll'), 10)
    timers.advanceTimersByTime(5)
    global.setTimeout(record('retry'), 5)
    timers.advanceTimersByTime(5)
  }).join(', ')
}

test('timeouts that are due at the same time run in a seeded order', () => {
  const orders = seeds.map((seed) => timeoutsAtTheSameTime({ order: 'random' }, seed))
  expect(new Set(orders)).toEqual(new Set(['poll 10, retry 10', 'retry 10, poll 10']))
  expect(seeds.map((seed) => timeoutsAtTheSameTime({ order: 'random' }, seed))).toEqual(orders)
  expect(new Set(seeds.map((seed) => timeoutsAtTheSameTime({}, seed)))).toEqual(
    new Set(['poll 10, retry 10']),
  )
})

test('a random order and jitter keep the order that Node.js and browsers guarantee', () => {
  const jitter = 20
  for (const seed of seeds) {
    const calls = simulate({ order: 'random', jitter }, seed, ({ global, timers, record }) => {
      global.setTimeout(record('debounce'), 5)
      global.setTimeout(record('request 1'), 10)
      global.setTimeout(record('request 2'), 10)
      global.setImmediate(record('flush 1'))
      global.setImmediate(record('flush 2'))
      global.requestAnimationFrame(record('paint 1'))
      global.requestAnimationFrame(record('paint 2'))
      global.requestIdleCallback(record('prefetch 1'))
      global.requestIdleCallback(record('prefetch 2'))
      // @sinonjs/fake-timers runs idle callbacks after all other timers
      timers.runAllTimers()
    })
    const names = calls.map((call) => call.split(' ').slice(0, -1).join(' '))
    const time = (name: string) => Number(calls[names.indexOf(name)].split(' ').at(-1))
    const index = (name: string) => names.indexOf(name)

    expect(index('debounce')).toBeLessThan(index('request 1'))
    expect(index('request 1')).toBeLessThan(index('request 2'))
    expect(index('flush 2')).toBe(index('flush 1') + 1)
    expect(index('paint 2')).toBe(index('paint 1') + 1)
    expect(index('prefetch 2')).toBe(index('prefetch 1') + 1)

    expect(time('debounce')).toBeGreaterThanOrEqual(5)
    expect(time('debounce')).toBeLessThanOrEqual(5 + jitter)
    expect(time('request 1')).toBeGreaterThanOrEqual(10)
    expect(time('request 2')).toBeLessThanOrEqual(10 + jitter)
    expect(time('flush 1')).toBeLessThanOrEqual(jitter)
    expect(time('paint 1')).toBeOneOf([16, 32])
  }
})

test('the callbacks of a frame run together, and timeouts that are due at the same time do not run between them', () => {
  const frameAndTimeouts = (config: FakeTimersConfig, seed: string) =>
    simulate(config, seed, ({ global, timers, record }) => {
      global.requestAnimationFrame(record('paint 1'))
      global.setTimeout(record('poll'), 16)
      global.requestAnimationFrame(record('paint 2'))
      global.setTimeout(record('retry'), 16)
      timers.advanceTimersByTime(20)
    }).join(', ')

  expect(new Set(seeds.map((seed) => frameAndTimeouts({ order: 'random' }, seed)))).toEqual(
    new Set([
      'paint 1 16, paint 2 16, poll 16, retry 16',
      'poll 16, paint 1 16, paint 2 16, retry 16',
      'poll 16, retry 16, paint 1 16, paint 2 16',
    ]),
  )
  // without a random order, the frame runs at the place of its first callback
  expect(new Set(seeds.map((seed) => frameAndTimeouts({ jitter: 1 }, seed)))).toEqual(
    new Set([
      'paint 1 16, paint 2 16, poll 16, retry 16',
      'paint 1 16, paint 2 16, poll 16, retry 17',
      'paint 1 16, paint 2 16, poll 17, retry 17',
    ]),
  )
})

test('idle callbacks are never late', () => {
  for (const seed of seeds.slice(0, 20)) {
    const calls = simulate({ jitter: 20 }, seed, ({ global, timers, record }) => {
      global.requestIdleCallback(record('prefetch'))
      timers.advanceTimersByTime(1)
      record('after the advance')()
    })
    expect(calls).toEqual(['prefetch 0', 'after the advance 1'])
  }
})

test('advanceTimersToNextFrame runs a frame that is late', () => {
  const runs = seeds.map((seed) =>
    simulate({ jitter: 40 }, seed, ({ global, timers, record }) => {
      global.requestAnimationFrame(record('paint'))
      timers.advanceTimersToNextFrame()
    }).join(', '),
  )
  expect(new Set(runs)).toEqual(new Set(['paint 16', 'paint 32', 'paint 48']))
})

test('the guarantees hold for many timers that are cleared, refreshed and repeated', () => {
  const jitter = 30
  for (const seed of seeds.slice(0, 20)) {
    // `index` is the position of the schedule among all schedules
    const calls: {
      name: string
      index: number
      delay: number
      scheduledAt: number
      calledAt: number
    }[] = []
    simulate({ order: 'random', jitter }, seed, ({ global, timers }) => {
      let nextIndex = 0
      const schedule = (name: string, delay: number, callback?: () => void) => {
        const entry = { name, index: nextIndex++, delay, scheduledAt: global.Date.now() }
        const timeout = global.setTimeout(() => {
          calls.push({ ...entry, calledAt: global.Date.now() })
          callback?.()
        }, delay)
        return {
          clear: () => global.clearTimeout(timeout),
          refresh: () => {
            entry.index = nextIndex++
            entry.scheduledAt = global.Date.now()
            timeout.refresh()
          },
        }
      }

      let heartbeat = { name: 'heartbeat', index: nextIndex++, delay: 25, scheduledAt: 0 }
      global.setInterval(() => {
        calls.push({ ...heartbeat, calledAt: global.Date.now() })
        // the interval is scheduled again before its callback runs
        heartbeat = { ...heartbeat, index: nextIndex++, scheduledAt: global.Date.now() }
      }, 25)
      const session = schedule('session', 200)
      for (let request = 0; request < 300; request++) {
        const timeout = schedule(`timeout ${request}`, 100 + (request % 3) * 50)
        schedule(`response ${request}`, 20 + ((request * 37) % 150), () => {
          timeout.clear()
          session.refresh()
        })
        timers.advanceTimersByTime(7)
      }
      timers.advanceTimersByTime(500)
    })

    const problems: string[] = []
    calls.forEach((call, position) => {
      const lateness = call.calledAt - call.scheduledAt - call.delay
      if (lateness < 0 || lateness > jitter) {
        problems.push(`${call.name} is ${lateness} ms late`)
      }
      for (const later of calls.slice(position + 1)) {
        if (later.index < call.index && later.delay <= call.delay) {
          problems.push(`${call.name} runs before ${later.name}`)
        }
      }
    })
    expect(calls.length).toBeGreaterThan(400)
    expect(problems).toEqual([])
  }
})

test('jitter changes the time of each timer, and the seed repeats it', () => {
  const run = (seed: string) =>
    simulate({ jitter: 20 }, seed, ({ global, timers, record }) => {
      global.setTimeout(record('debounce'), 5)
      global.setImmediate(record('flush'))
      global.requestAnimationFrame(record('paint'))
      timers.advanceTimersByTime(100)
    }).join(', ')
  const runs = seeds.map(run)
  expect(new Set(runs).size).toBeGreaterThan(50)
  expect(seeds.map(run)).toEqual(runs)
})

test('an interval with jitter counts its next call from the late call', () => {
  for (const seed of seeds.slice(0, 20)) {
    const calls = simulate({ jitter: 5 }, seed, ({ global, timers, record }) => {
      global.setInterval(record('heartbeat'), 10)
      timers.advanceTimersByTime(200)
    })
    const times = calls.map((call) => Number(call.split(' ').at(-1)))
    const gaps = times.map((time, index) => time - (times[index - 1] ?? 0))
    expect(gaps.every((gap) => gap >= 10 && gap <= 15)).toBe(true)
  }
})

test('fake timers without order and jitter do not use the random source', () => {
  const global = Object.assign(Object.create(null), { Date, setTimeout, clearTimeout })
  const timers = new FakeTimers({
    global,
    config: { order: 'fifo', jitter: 0 },
    getRandom: () => {
      throw new Error('the schedule used the random source')
    },
  })
  const before = Date.now()
  timers.useFakeTimers()
  const start = global.Date.now()
  const calls: number[] = []
  global.setTimeout(() => calls.push(global.Date.now() - start), 10)
  timers.advanceTimersByTime(10)
  timers.useRealTimers()
  expect(calls).toEqual([10])
  // the fake clock starts at the real time
  expect(start).toBeGreaterThanOrEqual(before)
  expect(start).toBeLessThanOrEqual(Date.now())
})

const DAY = 24 * 60 * 60 * 1000

// the time of `Date.now()` after the install, and the labels of the random sources that it used
function installTime(
  config: FakeTimersConfig,
  random: RandomSource,
  setup?: (timers: FakeTimers, global: typeof globalThis) => void,
) {
  const global = Object.assign(Object.create(null), { Date, setTimeout, clearTimeout })
  const labels: string[] = []
  const timers = new FakeTimers({
    global,
    config,
    getRandom: (label) => {
      labels.push(label)
      return random
    },
  })
  try {
    setup?.(timers, global)
    timers.useFakeTimers()
    return { time: global.Date.now(), labels }
  } finally {
    timers.useRealTimers()
  }
}

// a random source that returns these raw values, then zeros
function replay(values: number[]) {
  const random = createRandomSource(seeds[0])
  let index = 0
  random.uint32 = () => values[index++] ?? 0
  return random
}

test('with a random order or a jitter, the fake clock starts at a time from the seed', () => {
  const startTime = (config: FakeTimersConfig, seed: string) =>
    installTime(config, createRandomSource(seed)).time
  const times = seeds.map((seed) => startTime({ jitter: 5 }, seed))

  expect(seeds.map((seed) => startTime({ jitter: 5 }, seed))).toEqual(times)
  expect(seeds.map((seed) => startTime({ order: 'random' }, seed))).toEqual(times)
  expect(new Set(times).size).toBe(seeds.length)
  for (const time of times) {
    expect(time).toBeGreaterThanOrEqual(Date.UTC(2000, 0, 1))
    expect(time).toBeLessThan(Date.UTC(2038, 0, 1))
  }
  // edge cases that are rare with real dates
  const dates = times.map((time) => new Date(time))
  expect(times.some((time) => time % DAY === 0)).toBe(true)
  expect(times.some((time) => time % DAY === DAY - 1)).toBe(true)
  expect(dates.some((date) => new Date(date.valueOf() + DAY).getUTCDate() === 1)).toBe(true)
  expect(dates.some((date) => date.getUTCMonth() === 1)).toBe(true)
})

test('raw values of 0 start the fake clock at the start of 2000, and edge values give the last day and millisecond', () => {
  const start = (values: number[]) =>
    new Date(installTime({ jitter: 5 }, replay(values)).time).toISOString()
  const highest = 2 ** 32 - 1
  // the edge cases of `int(0, 11)` are January, February and December
  const february = 2 ** 32 - 2 ** 27

  expect(start([])).toBe('2000-01-01T00:00:00.000Z')
  expect(start([highest, highest, highest, highest])).toBe('2037-12-31T23:59:59.999Z')
  expect(start([0, february, highest, 0])).toBe('2000-02-29T00:00:00.000Z')
  expect(start([highest, february, highest, 0])).toBe('2037-02-28T00:00:00.000Z')
})

test('now, a system time before the install, and a second install keep their time', () => {
  const random = createRandomSource(seeds[0])

  expect(installTime({ jitter: 5, now: 1000 }, random)).toEqual({ time: 1000, labels: [] })
  expect(installTime({ jitter: 5 }, random, (timers) => timers.setSystemTime(2000))).toEqual({
    time: 2000,
    labels: [],
  })

  const start = installTime({ jitter: 5 }, createRandomSource(seeds[1])).time
  const second = installTime({ jitter: 5 }, createRandomSource(seeds[1]), (timers, global) => {
    timers.useFakeTimers()
    global.setTimeout(() => {}, 10)
    timers.advanceTimersByTime(100)
  })
  expect(second).toEqual({ time: start + 100, labels: ['vitest:clock', 'vitest:timers'] })
})

test('order and jitter reject invalid values', () => {
  // options from a JavaScript config file have no types
  const useFakeTimers = (options: object) => {
    const config = Object.assign(Object.create(null), options)
    const timers = new FakeTimers({ global: Object.create(globalThis), config })
    try {
      timers.useFakeTimers()
    } finally {
      timers.useRealTimers()
    }
  }
  expect(() => useFakeTimers({ order: 'lifo' })).toThrowErrorMatchingInlineSnapshot(
    `[TypeError: The "order" option of fake timers must be "fifo" or "random", received "lifo".]`,
  )
  expect(() => useFakeTimers({ jitter: -1 })).toThrowErrorMatchingInlineSnapshot(
    `[TypeError: The "jitter" option of fake timers must be an integer from 0 to 2147483647, received -1.]`,
  )
  expect(() => useFakeTimers({ jitter: 1.5 })).toThrowErrorMatchingInlineSnapshot(
    `[TypeError: The "jitter" option of fake timers must be an integer from 0 to 2147483647, received 1.5.]`,
  )
  expect(() => useFakeTimers({ jitter: '5' })).toThrowErrorMatchingInlineSnapshot(
    `[TypeError: The "jitter" option of fake timers must be an integer from 0 to 2147483647, received "5".]`,
  )
  expect(() => useFakeTimers({ jitter: 2 ** 31 })).toThrowErrorMatchingInlineSnapshot(
    `[TypeError: The "jitter" option of fake timers must be an integer from 0 to 2147483647, received 2147483648.]`,
  )
})
