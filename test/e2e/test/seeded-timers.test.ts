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
  return stderr.split('\n').filter((line) => /^ FAIL |^ +(Failed|Seeds?|Reproduced) {2}/.test(line))
}

declare module 'vitest' {
  interface TaskMeta {
    calls?: string[][]
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
        "heartbeat 26",
        "renew 0.373 33",
        "heartbeat 52",
        "expire 63",
        "heartbeat 80",
      ],
      [
        "heartbeat 25",
        "renew 0.968 33",
        "heartbeat 54",
        "expire 61",
        "heartbeat 81",
      ],
      [
        "heartbeat 27",
        "renew 0.125 30",
        "heartbeat 56",
        "expire 64",
        "heartbeat 82",
      ],
      [
        "heartbeat 27",
        "renew 0.232 33",
        "heartbeat 55",
        "expire 60",
        "heartbeat 84",
      ],
    ]
  `)
  expect(callsOf(results, 'signs out')).toMatchInlineSnapshot(`
    [
      [
        "sign out 10",
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

test('a random order and jitter throw in concurrent tests', async () => {
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

        test('polls the queue', () => {
          vi.useFakeTimers()
          setTimeout(() => {}, 100)
        })
      `,
    },
    { fakeTimers: { order: 'random' } },
  )
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "polling.test.js": {
        "polls the queue": "passed",
        "polls the status": [
          "Fake timers with a random \`order\` or a \`jitter\` cannot be used in concurrent tests and suites, because the order of the timers would depend on the order of the calls.",
        ],
      },
    }
  `)
})
