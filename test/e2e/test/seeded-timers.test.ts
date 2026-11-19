import type { TestCase, TestModule } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '#test-utils'

// the inline snapshots have the seeds of the run seed 0
function runSeededTests(...[structure, config, ...rest]: Parameters<typeof runInlineTests>) {
  return runInlineTests(structure, { seed: 0, ...config }, ...rest)
}

function findTest(modules: TestModule[], name: string): TestCase {
  const testCase = modules
    .flatMap((module) => [...module.children.allTests()])
    .find((testCase) => testCase.fullName === name)
  if (!testCase) {
    throw new Error(`The test "${name}" was not found.`)
  }
  return testCase
}

function seedLines(stderr: string): string[] {
  return stderr
    .split('\n')
    .filter((line) => /^ FAIL |^ +(Failed|Seeds?|Reproduced|Original|Values|Keep) {2}/.test(line))
}

declare module 'vitest' {
  interface TaskMeta {
    calls?: string[][]
    starts?: string[]
  }
}

const cacheTests = /* js */ `
import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})

function createCache() {
  let value = 'stale'
  return {
    get: () => value,
    // the response of a slow request
    refresh: () => setTimeout(() => { value = 'response' }, 10),
    invalidate: () => setTimeout(() => { value = 'fresh' }, 5),
  }
}

test('an invalidation wins over a slow response', { repeats: 9 }, () => {
  vi.useFakeTimers()
  const cache = createCache()
  cache.refresh()
  vi.advanceTimersByTime(5)
  cache.invalidate()
  vi.advanceTimersByTime(5)
  expect(cache.get()).toBe('fresh')
})
`

test('a random order of timers fails for some seeds, and the replay seed repeats the order', async () => {
  const fifo = await runSeededTests({ 'cache.test.js': cacheTests })
  expect(fifo.stderr).toBe('')
  expect(findTest(fifo.results, 'an invalidation wins over a slow response').result().state).toBe(
    'passed',
  )

  const { stderr, results } = await runSeededTests(
    { 'cache.test.js': cacheTests },
    { fakeTimers: { order: 'random' } },
  )
  const testCase = findTest(results, 'an invalidation wins over a slow response')
  expect(testCase.result().state).toBe('failed')
  // the test does not read `random`, the timers alone record the seed of each attempt
  const failed = testCase.attempts().filter((attempt) => attempt.state === 'failed')
  expect(failed.every((attempt) => attempt.seed)).toBe(true)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  cache.test.js > an invalidation wins over a slow response",
      "     Failed  9th repeat",
      "       Seed  fb91c90aa5dcf0b0",
      " Reproduced  2 of 2 runs",
      "     Values  setTimeout(callback, 5) runs before setTimeout(callback, 10)",
      "       Keep  seeds: ['fb91c90aa5dcf0b0:AQICDnZpdGVzdDpnbG9iYWxzDHZpdGVzdDpjbG9jawQAAg52aXRlc3Q6Z2xvYmFscw12aXRlc3Q6dGltZXJzAQGAgIDABw']",
    ]
  `)

  const [replaySeed] = failed.map((attempt) => attempt.seed)
  const replay = await runSeededTests(
    { 'cache.test.js': cacheTests },
    { fakeTimers: { order: 'random' }, $cliOptions: { replaySeed } },
  )
  const replayed = findTest(replay.results, 'an invalidation wins over a slow response')
  expect(replayed.result().state).toBe('failed')
  expect(replayed.result().errors?.[0].message).toBe(testCase.result().errors?.[0].message)
})

const renewalTests = /* js */ `
import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})

function addMonth(date) {
  const next = new Date(date)
  next.setUTCMonth(next.getUTCMonth() + 1)
  return next
}

test('a subscription renews in the next month', { repeats: 49 }, () => {
  vi.useFakeTimers({ jitter: 10 })
  const start = new Date()
  expect(addMonth(start).getUTCMonth(), start.toISOString()).toBe((start.getUTCMonth() + 1) % 12)
})
`

test('with a jitter, the fake clock starts at a date from the seed, the search shows the smallest date, and the replay repeats it', async () => {
  const name = 'a subscription renews in the next month'
  const { stderr, results } = await runSeededTests({ 'renewal.test.js': renewalTests })
  const testCase = findTest(results, name)
  const failed = testCase.attempts().filter((attempt) => attempt.state === 'failed')
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  renewal.test.js > a subscription renews in the next month",
      "     Failed  repeats 3, 16",
      "      Seeds  92a4c90587b04cf4 (this error), 7b8b62c4c1928204",
      " Reproduced  2 of 2 seeds",
      "   Original  AssertionError: 2002-03-31T12:26:06.312Z: expected 4 to be 3 // Object.is equality",
      "     Values  vi.useFakeTimers() starts at 2000-01-30T00:00:00.000Z",
      "       Keep  seeds: ['92a4c90587b04cf4:AQECDnZpdGVzdDpnbG9iYWxzDHZpdGVzdDpjbG9jawQDAADvwZCEDg']",
    ]
  `)
  expect(failed.map((attempt) => attempt.errors[0].message)).toMatchInlineSnapshot(`
    [
      "2000-01-30T00:00:00.000Z: expected 2 to be 1 // Object.is equality",
      "2000-01-30T00:00:00.000Z: expected 2 to be 1 // Object.is equality",
      "2001-01-29T22:01:19.149Z: expected 2 to be 1 // Object.is equality",
      "2001-01-29T22:01:19.149Z: expected 2 to be 1 // Object.is equality",
    ]
  `)

  const searched = failed.find((attempt) => attempt.shrink)
  expect(searched?.shrink).toMatchObject({ shrunk: true, reproduced: true })
  const replay = await runSeededTests(
    { 'renewal.test.js': renewalTests },
    { $cliOptions: { replaySeed: `${searched?.seed}:${searched?.shrink?.tape}` } },
  )
  expect(findTest(replay.results, name).result().errors?.[0].message).toBe(
    failed[0].errors[0].message,
  )
})

const sessionTests = /* js */ `
import { afterEach, test, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})

function track(task, run) {
  const calls = []
  run((name) => () => calls.push(name + ' ' + Date.now()))
  task.meta.calls = [...(task.meta.calls ?? []), calls]
}

test('renews the session', { repeats: 3 }, ({ task }) => {
  vi.useFakeTimers({ now: 0 })
  vi.useFakeRandom()
  track(task, (record) => {
    setTimeout(record('renew ' + Math.random().toFixed(3)), 30)
    setTimeout(record('expire'), 60)
    setInterval(record('heartbeat'), 25)
    vi.advanceTimersByTime(100)
  })
})

test('signs out', ({ task }) => {
  vi.useFakeTimers({ now: 0 })
  track(task, (record) => {
    setTimeout(record('sign out'), 10)
    vi.advanceTimersByTime(20)
  })
})
`

function callsOf(modules: TestModule[], name: string) {
  return findTest(modules, name).meta().calls
}

test('jitter comes from the seed of each test and does not change Math.random', async () => {
  const { stderr, results } = await runSeededTests(
    { 'session.test.js': sessionTests },
    { fakeTimers: { jitter: 4 } },
  )
  expect(stderr).toBe('')
  expect(callsOf(results, 'renews the session')).toMatchInlineSnapshot(`
    [
      [
        "heartbeat 29",
        "renew 0.152 33",
        "heartbeat 55",
        "expire 63",
        "heartbeat 81",
      ],
      [
        "heartbeat 26",
        "renew 0.080 30",
        "heartbeat 54",
        "expire 64",
        "heartbeat 82",
      ],
      [
        "heartbeat 26",
        "renew 0.144 30",
        "heartbeat 51",
        "expire 61",
        "heartbeat 78",
      ],
      [
        "heartbeat 29",
        "renew 0.174 30",
        "heartbeat 56",
        "expire 60",
        "heartbeat 84",
      ],
    ]
  `)
  expect(callsOf(results, 'signs out')).toMatchInlineSnapshot(`
    [
      [
        "sign out 11",
      ],
    ]
  `)

  const filtered = await runSeededTests(
    { 'session.test.js': sessionTests },
    { fakeTimers: { jitter: 4 }, testNamePattern: 'renews' },
  )
  expect(callsOf(filtered.results, 'renews the session')).toEqual(
    callsOf(results, 'renews the session'),
  )

  const withoutJitter = await runSeededTests({ 'session.test.js': sessionTests })
  const random = (calls: string[][] | undefined) =>
    calls?.map((run) => run.find((call) => call.startsWith('renew'))?.split(' ')[1])
  expect(random(callsOf(withoutJitter.results, 'renews the session'))).toEqual(
    random(callsOf(results, 'renews the session')),
  )
})

test('a now range in the config starts the fake clock at a date inside the range', async () => {
  const { stderr, results } = await runSeededTests(
    { 'renewal.test.js': renewalTests },
    { fakeTimers: { now: { min: Date.UTC(2024, 0, 1), max: Date.UTC(2026, 0, 1) - 1 } } },
  )
  const failed = findTest(results, 'a subscription renews in the next month')
    .attempts()
    .filter((attempt) => attempt.state === 'failed')
  expect(failed.map((attempt) => attempt.errors[0].message)).toMatchInlineSnapshot(`
    [
      "2024-01-30T00:00:00.000Z: expected 2 to be 1 // Object.is equality",
      "2024-01-30T00:00:00.000Z: expected 2 to be 1 // Object.is equality",
    ]
  `)
  // the search moves the start time toward the start of the range
  expect(seedLines(stderr).filter((line) => /^ +(Original|Values) {2}/.test(line)))
    .toMatchInlineSnapshot(`
    [
      "   Original  AssertionError: 2025-03-31T12:26:06.312Z: expected 4 to be 3 // Object.is equality",
      "     Values  vi.useFakeTimers() starts at 2024-01-30T00:00:00.000Z",
    ]
  `)
})

const startTests = /* js */ `
import { beforeAll, beforeEach, describe, test, vi } from 'vitest'

function record(task, start) {
  task.meta.starts = [...(task.meta.starts ?? []), start]
}

describe('installs in beforeAll', () => {
  let start
  beforeAll(() => {
    vi.useFakeTimers({ jitter: 1 })
    start = new Date().toISOString()
    vi.useRealTimers()
  })

  test('reads the start', { repeats: 2 }, ({ task }) => record(task, start))
})

describe('installs in beforeEach', () => {
  let start
  beforeEach(() => {
    vi.useFakeTimers({ jitter: 1 })
    start = new Date().toISOString()
    vi.useRealTimers()
  })

  test('reads the start', { repeats: 2 }, ({ task }) => record(task, start))
})
`

function startsOf(modules: TestModule[]) {
  return Object.fromEntries(
    modules
      .flatMap((module) => [...module.children.allTests()])
      .map((testCase) => [testCase.fullName, testCase.meta().starts]),
  )
}

test('an install in beforeAll starts at the time of the suite in every repeat', async () => {
  const { stderr, results } = await runSeededTests({ 'start.test.js': startTests })
  expect(stderr).toBe('')
  expect(startsOf(results)).toMatchInlineSnapshot(`
    {
      "installs in beforeAll > reads the start": [
        "2001-11-21T18:38:53.166Z",
        "2001-11-21T18:38:53.166Z",
        "2001-11-21T18:38:53.166Z",
      ],
      "installs in beforeEach > reads the start": [
        "2000-02-14T11:36:08.848Z",
        "2001-09-07T23:43:09.754Z",
        "2000-07-05T20:57:51.692Z",
      ],
    }
  `)

  const filtered = await runSeededTests(
    { 'start.test.js': startTests },
    { testNamePattern: 'beforeAll' },
  )
  expect(startsOf(filtered.results)['installs in beforeAll > reads the start']).toEqual(
    startsOf(results)['installs in beforeAll > reads the start'],
  )
})

test('a now range of dates in a config file gives the same start time in every pool', async () => {
  const files = {
    'start.test.js': /* js */ `
      import { test, vi } from 'vitest'

      test('reads the start', ({ task }) => {
        vi.useFakeTimers()
        task.meta.starts = [new Date().toISOString()]
        vi.useRealTimers()
      })
    `,
    'vitest.config.js': /* js */ `
      export default {
        test: {
          seed: 0,
          fakeTimers: {
            now: { min: new Date('2024-06-01T00:00:00.000Z'), max: new Date('2024-06-30T23:59:59.999Z') },
          },
        },
      }
    `,
  }
  const starts: Record<string, unknown> = {}
  for (const pool of ['threads', 'forks', 'vmThreads', 'vmForks'] as const) {
    const { stderr, results } = await runInlineTests(files, { $cliOptions: { pool } })
    expect.soft(stderr, pool).toBe('')
    starts[pool] = startsOf(results)['reads the start']
  }
  expect(starts.threads).toMatchInlineSnapshot(`
    [
      "2024-06-18T00:00:00.000Z",
    ]
  `)
  expect(Object.values(starts)).toEqual([
    starts.threads,
    starts.threads,
    starts.threads,
    starts.threads,
  ])
})

test('an invalid option fails when Vitest starts', async () => {
  const { stderr } = await runInlineTests({
    'cache.test.js': cacheTests,
    'vitest.config.js': `export default { test: { fakeTimers: { order: 'shuffle' } } }`,
  })
  expect(stderr.split('\n')[0]).toMatchInlineSnapshot(
    `"TypeError: The "order" option of fake timers must be "fifo" or "random", received "shuffle"."`,
  )
  const range = await runInlineTests({
    'cache.test.js': cacheTests,
    'vitest.config.js': `export default { test: { fakeTimers: { now: { min: new Date(Date.UTC(2030, 0, 1)) } } } }`,
  })
  expect(range.stderr.split('\n')[0]).toMatchInlineSnapshot(
    `"TypeError: The "now" range of fake timers must have a "min" and a "max" time, received {"min":"2030-01-01T00:00:00.000Z"}."`,
  )
})

test('a random order, jitter and a now range throw in concurrent tests', async () => {
  const { errorTree } = await runInlineTests(
    {
      'polling.test.js': /* js */ `
        import { afterEach, test, vi } from 'vitest'

        afterEach(() => {
          vi.useRealTimers()
        })

        test.concurrent('polls the status', () => {
          vi.useFakeTimers()
          setTimeout(() => {}, 100)
        })

        test.concurrent('polls the jobs', () => {
          vi.useFakeTimers({ now: 0 })
          setTimeout(() => {}, 100)
        })

        test('polls the queue', () => {
          vi.useFakeTimers()
          setTimeout(() => {}, 100)
        })
      `,
      // a separate file, because the fake clock of the other concurrent tests is still installed
      'logs.test.js': /* js */ `
        import { test, vi } from 'vitest'

        test.concurrent('polls the logs', () => {
          vi.useFakeTimers({ order: 'fifo', now: { min: 0, max: 1000 } })
        })
      `,
    },
    { fakeTimers: { order: 'random' } },
  )
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "logs.test.js": {
        "polls the logs": [
          "Fake timers with a start time from the seed cannot be used in concurrent tests and suites, because the start time would depend on the order of the calls.",
        ],
      },
      "polling.test.js": {
        "polls the jobs": [
          "Fake timers with a random \`order\` or a \`jitter\` cannot be used in concurrent tests and suites, because the order of the timers would depend on the order of the calls.",
        ],
        "polls the queue": "passed",
        "polls the status": [
          "Fake timers with a start time from the seed cannot be used in concurrent tests and suites, because the start time would depend on the order of the calls.",
        ],
      },
    }
  `)
})
