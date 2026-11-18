import type { TestCase, TestModule, TestShrinkProgress } from 'vitest/node'
import { renderString } from 'ansivision'
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

// on Windows, the replay command quotes arguments for PowerShell
function normalizeCommand(command: string): string {
  if (process.platform !== 'win32') {
    return command
  }
  return command.replace(/"((?:[^"`]|`.)*)"/g, (_, value: string) => {
    return `'${value.replace(/`(.)/g, '$1').replace(/'/g, `'\\''`)}'`
  })
}

// the time of shrinking changes on every run
function seedLines(stderr: string): string[] {
  return stderr
    .replace(/^ +Replay {2}.*$/gm, normalizeCommand)
    .replace(/runs \((\d+ms|\d+\.\d+s)/g, 'runs (<time>')
    .split('\n')
    .filter((line) =>
      /^ FAIL |^ +(Seed|Reproduced|Shrunk|Original|Values|Keep|Replay) {2}|^ {13}\S/.test(line),
    )
}

function getFailedSeed(testCase: TestCase): string {
  const seed = testCase.attempts().find((attempt) => attempt.state === 'failed')?.seed
  if (!seed) {
    throw new Error(`The test "${testCase.fullName}" has no failed seed.`)
  }
  return seed
}

const queueTests = /* js */ `
import { expect, test } from 'vitest'

// a queue that drops the jobs above its size limit
function enqueue(jobs) {
  return jobs.filter((size) => size <= 500)
}

test('the queue keeps every job', ({ random }) => {
  const jobs = random.many(() => random.int(0, 1000))
  expect(enqueue(jobs)).toEqual(jobs)
})
`

// each run takes a few milliseconds, so the search sends its progress more than once
const slowQueueTests = queueTests.replace(
  "test('the queue keeps every job', ({ random }) => {",
  "test('the queue keeps every job', async ({ random }) => {\n  await new Promise((resolve) => setTimeout(resolve, 5))",
)

test('shrinks the random values of a failed test, and the tape replays the smallest input', async () => {
  const name = 'the queue keeps every job'
  const failed = await runSeededTests({ 'queue.test.js': queueTests })
  const replaySeed = getFailedSeed(findTest(failed.results, name))

  const { stderr, stdout, results } = await runSeededTests(
    { 'queue.test.js': queueTests },
    { $cliOptions: { replaySeed, shrink: true } },
  )
  expect(stdout).toMatch('Shrinking each failed test for up to 30.00s')
  const testCase = findTest(results, name)
  expect(testCase.result().state).toBe('failed')
  expect(testCase.result().errors?.map((error) => error.message)).toMatchInlineSnapshot(`
    [
      "expected [] to deeply equal [ 501 ]",
    ]
  `)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  queue.test.js > the queue keeps every job",
      "       Seed  4b22ec81796e2c5c",
      "     Shrunk  from 15 to 2 random values in 163 runs (<time>)",
      "   Original  AssertionError: expected [ 142, 500, 432 ] to deeply equal [ 142, 891, 914, 546, 714, 500, 432 ]",
      "     Values  random.many() → [ 501 ]",
      "       Keep  seeds: ['4b22ec81796e2c5c:AQEAAwKr1arVAtHf-sAH']",
      "     Replay  vitest run queue.test.js -t '^the queue keeps every job$' --seed 0 --replay-seed 4b22ec81796e2c5c --replay-tape AQEAAwKr1arVAtHf-sAH",
    ]
  `)
  const shrink = testCase.attempts()[0].shrink
  expect(shrink).toMatchObject({ shrunk: true, reproduced: true, values: 2 })

  const replay = await runSeededTests(
    { 'queue.test.js': queueTests },
    { $cliOptions: { replaySeed, replayTape: shrink?.tape } },
  )
  const replayed = findTest(replay.results, name)
  expect(replayed.result().errors?.map((error) => error.message)).toEqual(
    testCase.result().errors?.map((error) => error.message),
  )
  expect(replay.stdout).toMatch(`Replaying seed "${replaySeed}" with a random tape`)
  expect(replay.stdout).not.toMatch('Shrinking')
})

test('a failed test shrinks without a flag', async () => {
  const name = 'the queue keeps every job'
  const { stderr, results } = await runSeededTests({ 'queue.test.js': queueTests })
  const testCase = findTest(results, name)
  expect(testCase.result().errors?.map((error) => error.message)).toMatchInlineSnapshot(`
    [
      "expected [] to deeply equal [ 501 ]",
    ]
  `)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  queue.test.js > the queue keeps every job",
      "       Seed  4b22ec81796e2c5c",
      " Reproduced  2 of 2 runs",
      "     Shrunk  from 15 to 2 random values in 163 runs (<time>)",
      "   Original  AssertionError: expected [ 142, 500, 432 ] to deeply equal [ 142, 891, 914, 546, 714, 500, 432 ]",
      "     Values  random.many() → [ 501 ]",
      "       Keep  seeds: ['4b22ec81796e2c5c:AQEAAwKr1arVAtHf-sAH']",
      "     Replay  vitest run queue.test.js -t '^the queue keeps every job$' --seed 0 --replay-seed 4b22ec81796e2c5c --replay-tape AQEAAwKr1arVAtHf-sAH",
    ]
  `)
  // the replay of the failed seed records the random values for the search
  expect(testCase.attempts().map(({ state, retryIndex }) => [state, retryIndex])).toEqual([
    ['failed', 0],
    ['failed', 1],
  ])
  expect(testCase.attempts()[1].shrink).toMatchObject({ shrunk: true, reproduced: true })
})

test.for([
  ['--no-shrink', { $cliOptions: { shrink: false } }, queueTests],
  ['the config option', { shrink: false }, queueTests],
  [
    'the test option',
    {},
    queueTests.replace(
      "test('the queue keeps every job', ({ random }) => {",
      "test('the queue keeps every job', { shrink: false }, ({ random }) => {",
    ),
  ],
] as const)('%s turns the search off', async ([, config, source]) => {
  const { stderr, results } = await runSeededTests({ 'queue.test.js': source }, config)
  const testCase = findTest(results, 'the queue keeps every job')
  expect(testCase.attempts().map(({ state, shrink }) => [state, shrink])).toEqual([
    ['failed', undefined],
  ])
  expect(seedLines(stderr).filter((line) => /Shrunk|Keep/.test(line))).toEqual([])
})

test('a failed test without random values runs 1 time', async () => {
  const { stderr, results } = await runSeededTests({
    'total.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('the total has 2 decimals', () => {
        expect((0.1 + 0.2).toFixed(2)).toBe('0.3')
      })
    `,
  })
  const testCase = findTest(results, 'the total has 2 decimals')
  expect(testCase.attempts().map(({ state }) => state)).toEqual(['failed'])
  expect(seedLines(stderr)).toEqual([' FAIL  total.test.js > the total has 2 decimals'])
})

test('a failure that does not reproduce gets no search', async () => {
  const { stderr, results } = await runSeededTests({
    'cache.test.js': /* js */ `
      import { expect, test } from 'vitest'

      // the first request fills the cache
      let cached = false
      function getPrice(id) {
        const hit = cached
        cached = true
        return hit ? id * 10 : undefined
      }

      test('the price comes from the cache', ({ random }) => {
        expect(getPrice(random.int(1, 100))).toBeDefined()
      })
    `,
  })
  const testCase = findTest(results, 'the price comes from the cache')
  expect(testCase.result().state).toBe('failed')
  expect(testCase.attempts().map(({ state, shrink }) => [state, shrink])).toEqual([
    ['failed', undefined],
    ['passed', undefined],
  ])
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  cache.test.js > the price comes from the cache",
      "       Seed  6d24c371eee69605",
      " Reproduced  1 of 2 runs: the test depends on more than its seed",
      "     Replay  vitest run cache.test.js -t '^the price comes from the cache$' --seed 0 --replay-seed 6d24c371eee69605",
    ]
  `)
})

test('with `retry`, only a seed that fails in every retry shrinks', async () => {
  const { stderr, results } = await runSeededTests({
    'queue.test.js': /* js */ `
      import { expect, test } from 'vitest'

      function enqueue(jobs) {
        return jobs.filter((size) => size <= 500)
      }

      test('the queue keeps every job', { retry: 1 }, ({ random }) => {
        const jobs = random.many(() => random.int(0, 1000))
        expect(enqueue(jobs)).toEqual(jobs)
      })

      let first = true
      test('the queue is ready after the first try', { retry: 1 }, ({ random }) => {
        const ready = !first
        first = false
        expect(ready || random.bool()).toBe(true)
      })
    `,
  })
  const failed = findTest(results, 'the queue keeps every job')
  expect(failed.attempts().map(({ state, retryIndex }) => [state, retryIndex])).toEqual([
    ['failed', 0],
    ['failed', 1],
  ])
  expect(failed.attempts()[1].shrink).toMatchObject({ shrunk: true, reproduced: true })
  const flaky = findTest(results, 'the queue is ready after the first try')
  expect(flaky.result().state).toBe('passed')
  expect(flaky.attempts().every((attempt) => !attempt.shrink)).toBe(true)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  queue.test.js > the queue keeps every job",
      "       Seed  4b22ec81796e2c5c",
      " Reproduced  2 of 2 runs",
      "     Shrunk  from 15 to 2 random values in 163 runs (<time>)",
      "   Original  AssertionError: expected [ 142, 500, 432 ] to deeply equal [ 142, 891, 914, 546, 714, 500, 432 ]",
      "     Values  random.many() → [ 501 ]",
      "       Keep  seeds: ['4b22ec81796e2c5c:AQEAAwKr1arVAtHf-sAH']",
      "     Replay  vitest run queue.test.js -t '^the queue keeps every job$' --seed 0 --replay-seed 4b22ec81796e2c5c --replay-tape AQEAAwKr1arVAtHf-sAH",
    ]
  `)
})

test('each kind of failure shrinks 1 seed', async () => {
  const { stderr, results } = await runSeededTests({
    'box.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('an order fits in 1 box', { repeats: 49 }, ({ random }) => {
        const weight = random.int(1, 1000)
        const size = random.int(1, 100)
        expect(weight, 'too heavy').toBeLessThan(900)
        expect(size, 'too large').toBeLessThan(95)
      })
    `,
  })
  const testCase = findTest(results, 'an order fits in 1 box')
  expect(testCase.attempts().filter((attempt) => attempt.shrink)).toHaveLength(2)
  // the runs of the search do not change the count of repeats
  expect(testCase.diagnostic()?.repeatCount).toBe(49)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  box.test.js > an order fits in 1 box",
      " Reproduced  10 of 10 seeds",
      "     Shrunk  from 2 to 1 random values in 80 runs (<time>)",
      "   Original  AssertionError: too heavy: expected 935 to be less than 900",
      "     Values  random.int(1, 1000) → 900",
      "       Keep  seeds: ['c3fa9b6a559061f2:AQEAAgHpmIq-DQ']",
      "     Replay  vitest run box.test.js -t '^an order fits in 1 box$' --seed 0 --replay-seed c3fa9b6a559061f2 --replay-tape AQEAAgHpmIq-DQ",
      " FAIL  box.test.js > an order fits in 1 box",
      " Reproduced  6 of 6 seeds",
      "     Shrunk  to smaller random values in 81 runs (<time>)",
      "   Original  AssertionError: too large: expected 100 to be less than 95",
      "     Values  random.int(1, 100) → 95",
      "       Keep  seeds: ['faf87ac6270b0af1:AQEAAgIA9LLmjA4']",
      "     Replay  vitest run box.test.js -t '^an order fits in 1 box$' --seed 0 --replay-seed faf87ac6270b0af1 --replay-tape AQEAAgIA9LLmjA4",
    ]
  `)
})

test('a failure that reaches the `bail` limit stops its search', async () => {
  const { results } = await runSeededTests(
    {
      'queue.test.js': `${queueTests.replace(
        "test('the queue keeps every job', ({ random }) => {",
        "test('the queue keeps every job', async ({ random }) => {\n  await new Promise((resolve) => setTimeout(resolve, 50))",
      )}\ntest('the queue is empty at the start', () => {})\n`,
    },
    { bail: 1 },
  )
  const testCase = findTest(results, 'the queue keeps every job')
  // without the stop, the search takes more than 150 runs
  expect(testCase.attempts()[1].shrink).toMatchObject({ cancelled: true })
  expect(testCase.attempts()[1].shrink?.runs).toBeLessThan(20)
  expect(findTest(results, 'the queue is empty at the start').result().state).toBe('skipped')
})

test('an entry with a tape in `seeds` runs the smallest input on every run', async () => {
  // the seed and the tape of the first test
  const entry = '4b22ec81796e2c5c:AQEAAwKr1arVAtHf-sAH'
  const { stderr, results } = await runSeededTests({
    'queue.test.js': queueTests.replace(
      "test('the queue keeps every job', ({ random }) => {",
      `test('the queue keeps every job', { seeds: ['${entry}'] }, ({ random }) => {`,
    ),
  })
  const testCase = findTest(results, 'the queue keeps every job')
  const failed = testCase.attempts().filter((attempt) => attempt.state === 'failed')
  // the replay of the failed repeat reads the tape too
  expect(failed.map((attempt) => [attempt.repeatIndex, attempt.retryIndex, attempt.seed])).toEqual([
    [0, 0, '4b22ec81796e2c5c'],
    [0, 1, '4b22ec81796e2c5c'],
  ])
  expect(failed.map((attempt) => attempt.errors?.[0].message)).toEqual([
    'expected [] to deeply equal [ 501 ]',
    'expected [] to deeply equal [ 501 ]',
  ])
  expect(seedLines(stderr).filter((line) => line.includes('Replay'))).toMatchInlineSnapshot(`
    [
      "     Replay  vitest run queue.test.js -t '^the queue keeps every job$' --seed 0 --replay-seed 4b22ec81796e2c5c --replay-tape AQEAAwKr1arVAtHf-sAH",
    ]
  `)
})

test('a kept tape still runs when the test reads more random values after a change', async () => {
  const { stderr, results } = await runSeededTests({
    'queue.test.js': /* js */ `
      import { expect, test } from 'vitest'

      function enqueue(jobs) {
        return jobs.filter((size) => size <= 500)
      }

      test('the queue keeps every job', {
        seeds: ['4b22ec81796e2c5c:AQEAAwKr1arVAtHf-sAH'],
      }, ({ random }) => {
        const jobs = random.many(() => random.int(0, 1000))
        // added after the tape was kept: they read many more values than the tape has
        const network = random.fork('network')
        const delays = Array.from({ length: 2000 }, () => network.int(0, 50))
        const retries = Array.from({ length: 2000 }, () => random.int(0, 3))
        expect(delays).toHaveLength(retries.length)
        expect(enqueue(jobs)).toEqual(jobs)
      })
    `,
  })
  expect(stderr).not.toMatch('after the end of the tape')
  const testCase = findTest(results, 'the queue keeps every job')
  const failed = testCase.attempts().filter((attempt) => attempt.state === 'failed')
  // the jobs still come from the tape, the new values come from the seed
  expect(failed.map((attempt) => attempt.errors?.[0].message)).toEqual([
    'expected [] to deeply equal [ 501 ]',
    'expected [] to deeply equal [ 501 ]',
  ])
})

test('an entry with a tape that is not valid throws an error', async () => {
  const { stderr } = await runSeededTests({
    'queue.test.js': queueTests.replace(
      "test('the queue keeps every job', ({ random }) => {",
      "test('the queue keeps every job', { seeds: ['4b22ec81796e2c5c:not-a-tape!'] }, ({ random }) => {",
    ),
  })
  expect(stderr.split('\n').filter((line) => line.startsWith('TypeError'))).toMatchInlineSnapshot(`
    [
      "TypeError: The tape of the seed "4b22ec81796e2c5c" in "seeds" is not valid. Copy the entry from the "Keep" line of a failed test.",
    ]
  `)
})

test('shrinks the values of `vi.useFakeRandom`', async () => {
  const name = 'a coupon code has no 7'
  const structure = {
    'coupon.test.js': /* js */ `
      import { expect, test, vi } from 'vitest'

      test('a coupon code has no 7', () => {
        vi.useFakeRandom()
        const code = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('')
        expect(code).not.toMatch('7')
      })
    `,
  }
  const failed = await runSeededTests(structure, { repeats: 20 })
  const replaySeed = getFailedSeed(findTest(failed.results, name))

  const { stderr, results } = await runSeededTests(structure, {
    $cliOptions: { replaySeed, shrink: true },
  })
  expect(findTest(results, name).result().errors?.[0].message).toMatchInlineSnapshot(
    `"expected '70000000' not to match '7'"`,
  )
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  coupon.test.js > a coupon code has no 7",
      "       Seed  8da5bf1fb11cc217",
      "     Shrunk  from 16 to 1 random values in 86 runs (<time>)",
      "   Original  AssertionError: expected '68137941' not to match '7'",
      "     Values  Math.random() → 0.7000000029802322",
      "       Keep  seeds: ['8da5bf1fb11cc217:AQEBDnZpdGVzdDpnbG9iYWxzEAHA5syZCw']",
      "     Replay  vitest run coupon.test.js -t '^a coupon code has no 7$' --seed 0 --replay-seed 8da5bf1fb11cc217 --replay-tape AQEBDnZpdGVzdDpnbG9iYWxzEAHA5syZCw",
    ]
  `)
})

test('shows the fake random function that the test called', async () => {
  const name = 'an invite code has no letters that look like digits'
  const structure = {
    'invite.test.js': /* js */ `
      import { expect, test, vi } from 'vitest'

      const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

      function createInviteCode() {
        const bytes = crypto.getRandomValues(new Uint8Array(6))
        return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
      }

      test('an invite code has no letters that look like digits', () => {
        vi.useFakeRandom()
        expect(createInviteCode()).not.toMatch(/[IO]/)
      })
    `,
  }
  const failed = await runSeededTests(structure, { repeats: 20 })
  const replaySeed = getFailedSeed(findTest(failed.results, name))

  const { stderr } = await runSeededTests(structure, {
    $cliOptions: { replaySeed, shrink: true },
  })
  expect(seedLines(stderr).filter((line) => line.includes('Values'))).toMatchInlineSnapshot(`
    [
      "     Values  crypto.getRandomValues(Uint8Array(6)) → Uint8Array [ 158, 0, 0, 0, 0, 0 ]",
    ]
  `)
})

test('shows the fake timer that the test created', async () => {
  const name = 'the response arrives before the timeout'
  const structure = {
    'request.test.js': /* js */ `
      import { expect, test, vi } from 'vitest'

      // the server answers in 90 ms, and the client waits 100 ms
      function request() {
        return new Promise((resolve, reject) => {
          setTimeout(function timeout() {
            reject(new Error('The request timed out.'))
          }, 100)
          setTimeout(function respond() {
            resolve('data')
          }, 90)
        })
      }

      test('the response arrives before the timeout', async () => {
        vi.useFakeTimers({ jitter: 20 })
        const response = request()
        vi.runAllTimers()
        await expect(response).resolves.toBe('data')
      })
    `,
  }
  const failed = await runSeededTests(structure, { repeats: 20 })
  const replaySeed = getFailedSeed(findTest(failed.results, name))

  const { stderr } = await runSeededTests(structure, {
    $cliOptions: { replaySeed, shrink: true },
  })
  expect(seedLines(stderr).filter((line) => line.includes('Values'))).toMatchInlineSnapshot(`
    [
      "     Values  setTimeout(respond, 90) runs 10 ms late, after 100 ms",
    ]
  `)
})

test('shows the value of a span instead of the calls inside it', async () => {
  const name = 'finds the orders above the limit'
  const structure = {
    'orders.test.js': /* js */ `
      import { expect, test } from 'vitest'

      const LIMIT = 250

      function createOrder(random) {
        return random.span('order', () => ({
          quantity: random.int(1, 10),
          price: random.int(1, 100),
        }))
      }

      // the check forgets the shipping cost
      function isAboveLimit(order, shipping) {
        return order.quantity * order.price > LIMIT
      }

      test('finds the orders above the limit', ({ random }) => {
        const order = createOrder(random)
        const shipping = random.int(0, 20)
        expect(isAboveLimit(order, shipping)).toBe(order.quantity * order.price + shipping > LIMIT)
      })
    `,
  }
  const failed = await runSeededTests(structure, { repeats: 500 })
  const replaySeed = getFailedSeed(findTest(failed.results, name))

  const { stderr } = await runSeededTests(structure, {
    $cliOptions: { replaySeed, shrink: true },
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  orders.test.js > finds the orders above the limit",
      "       Seed  3815c9bad33abc6a",
      "     Shrunk  to smaller random values in 240 runs (<time>)",
      "     Values  random.span('order') → { quantity: 10, price: 24 }",
      "             random.int(0, 20) → 11",
      "       Keep  seeds: ['3815c9bad33abc6a:AQEAAwOAgIDADarmzLkD6bbb7Qc']",
      "     Replay  vitest run orders.test.js -t '^finds the orders above the limit$' --seed 0 --replay-seed 3815c9bad33abc6a --replay-tape AQEAAwOAgIDADarmzLkD6bbb7Qc",
    ]
  `)
})

test('a long value shows only its first properties', async () => {
  const name = 'a profile has a name'
  const structure = {
    'profile.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('a profile has a name', ({ random }) => {
        const profile = random.span('profile', () => ({
          name: random.pick(['Alice', 'Bob', '']),
          email: random.pick(['alice@example.com', 'bob@example.com']),
          city: random.pick(['Berlin', 'Paris', 'Tokyo']),
          timezone: random.pick(['Europe/Berlin', 'Europe/Paris', 'Asia/Tokyo']),
          language: random.pick(['de', 'fr', 'ja']),
        }))
        expect(profile.name).not.toBe('')
      })
    `,
  }
  const failed = await runSeededTests(structure, { repeats: 20 })
  const replaySeed = getFailedSeed(findTest(failed.results, name))

  const { stderr } = await runSeededTests(structure, {
    $cliOptions: { replaySeed, shrink: true },
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  profile.test.js > a profile has a name",
      "       Seed  c1af4cda1f3615de",
      "     Shrunk  from 5 to 1 random values in 80 runs (<time>)",
      "     Values  random.span('profile') → { name: '', email: 'alice@example.com', city: 'Berlin', …(2) }",
      "       Keep  seeds: ['c1af4cda1f3615de:AQEABQGq1arVCg']",
      "     Replay  vitest run profile.test.js -t '^a profile has a name$' --seed 0 --replay-seed c1af4cda1f3615de --replay-tape AQEABQGq1arVCg",
    ]
  `)
})

test('a run that reads values after the end of the tape stops early', async () => {
  const name = 'a worker gets a job in 3 tries'
  const structure = {
    'worker.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('a worker gets a job in 3 tries', ({ random }) => {
        let tries = 1
        while (!random.bool(0.2)) {
          tries++
        }
        expect(tries).toBeLessThanOrEqual(3)
      })
    `,
  }
  const failed = await runSeededTests(structure, { repeats: 20 })
  const replaySeed = getFailedSeed(findTest(failed.results, name))

  const { stderr, results } = await runSeededTests(structure, {
    $cliOptions: { replaySeed, shrink: true },
  })
  // the smallest input has 3 values of `false` (zeros) and 1 value of `true`
  expect(findTest(results, name).attempts()[0].shrink?.values).toBe(4)
  expect(findTest(results, name).result().errors?.[0].message).toMatchInlineSnapshot(
    `"expected 4 to be less than or equal to 3"`,
  )
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  worker.test.js > a worker gets a job in 3 tries",
      "       Seed  1f0ac7f5d19cb1b4",
      "     Shrunk  from 6 to 4 random values in 92 runs (<time>)",
      "   Original  AssertionError: expected 6 to be less than or equal to 3",
      "     Values  random.bool(0.2) → true",
      "       Keep  seeds: ['1f0ac7f5d19cb1b4:AQEABAQAAADNmbPmDA']",
      "     Replay  vitest run worker.test.js -t '^a worker gets a job in 3 tries$' --seed 0 --replay-seed 1f0ac7f5d19cb1b4 --replay-tape AQEABAQAAADNmbPmDA",
    ]
  `)
})

test('only the last run reports its logs, annotations and artifacts', async () => {
  const name = 'the queue keeps every job'
  const structure = {
    'queue.test.js': queueTests
      .replace(
        '  expect(enqueue(jobs)).toEqual(jobs)',
        `  console.log('jobs', jobs.length)
  await annotate(\`\${jobs.length} jobs\`)
  await recordArtifact(task, { type: 'jobs', count: jobs.length })
  expect(enqueue(jobs)).toEqual(jobs)`,
      )
      .replace('({ random }) => {', 'async ({ random, annotate, task }) => {')
      .replace(
        "import { expect, test } from 'vitest'",
        "import { expect, recordArtifact, test } from 'vitest'",
      ),
  }
  const failed = await runSeededTests(structure)
  const replaySeed = getFailedSeed(findTest(failed.results, name))

  const { stdout, results } = await runSeededTests(structure, {
    $cliOptions: { replaySeed, shrink: true },
  })
  const testCase = findTest(results, name)
  expect(testCase.attempts()[0].shrink?.runs).toBeGreaterThan(2)
  // the failed attempt and the run of the smallest input
  expect(stdout.split('\n').filter((line) => line.startsWith('jobs'))).toEqual(['jobs 7', 'jobs 1'])
  expect(testCase.annotations().map((annotation) => annotation.message)).toEqual([
    '7 jobs',
    '1 jobs',
  ])
  expect(
    testCase.artifacts().map((artifact) => ('count' in artifact ? artifact.count : undefined)),
  ).toEqual([7, 1])
})

test('a run of a smaller input that waits too long is stopped', async () => {
  const name = 'the queue keeps every job'
  const structure = {
    'queue.test.js': queueTests
      .replace(
        '  expect(enqueue(jobs)).toEqual(jobs)',
        `  // without jobs, the queue never answers
  await new Promise((resolve) => {
    if (jobs.length) {
      resolve()
    }
  })
  expect(enqueue(jobs)).toEqual(jobs)`,
      )
      .replace('({ random }) => {', 'async ({ random }) => {'),
  }
  const failed = await runSeededTests(structure)
  const replaySeed = getFailedSeed(findTest(failed.results, name))

  const { results } = await runSeededTests(structure, {
    testTimeout: 5000,
    $cliOptions: { replaySeed, shrink: 2000 },
  })
  const shrink = findTest(results, name).attempts()[0].shrink
  // the first run without jobs would take the full test timeout
  expect(shrink?.duration).toBeLessThan(5000)
  expect(shrink?.runs).toBeGreaterThan(5)
  expect(shrink).toMatchObject({ shrunk: true, reproduced: true })
})

test('a long tape is not printed', async () => {
  const name = 'the sum is small'
  const structure = {
    'sum.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('the sum is small', ({ random }) => {
        const values = Array.from({ length: 2000 }, () => random.int(0, 1000))
        expect(values.reduce((sum, value) => sum + value, 0)).toBeLessThan(500_000)
      })
    `,
  }
  const { stderr, results } = await runSeededTests(structure, {
    $cliOptions: { replaySeed: '0000000000000000', shrink: 1000 },
  })
  // at least 500 values of 1000, and each has 5 bytes
  expect(findTest(results, name).attempts()[0].shrink?.tape?.length).toBeGreaterThan(2000)
  expect(
    seedLines(stderr)
      .filter((line) => /^ +(Keep|Replay) {2}/.test(line))
      .map((line) => line.replace(/\d+ characters/, '<count> characters')),
  ).toMatchInlineSnapshot(`
    [
      "       Keep  not shown, because the tape has <count> characters. Replay runs the seed without it",
      "     Replay  vitest run sum.test.js -t '^the sum is small$' --seed 0 --replay-seed 0000000000000000",
    ]
  `)
})

test('does not shrink a test that timed out', async () => {
  const name = 'a job finishes in time'
  const structure = {
    'job.test.js': /* js */ `
      import { test } from 'vitest'

      test('a job finishes in time', { timeout: 50 }, async ({ random }) => {
        const duration = random.int(0, 200)
        await new Promise((resolve) => setTimeout(resolve, duration))
      })
    `,
  }
  const failed = await runSeededTests(structure, { repeats: 5 })
  const replaySeed = getFailedSeed(findTest(failed.results, name))

  const { stderr, results } = await runSeededTests(structure, {
    $cliOptions: { replaySeed, shrink: true },
  })
  expect(findTest(results, name).attempts()[0].shrink).toMatchObject({
    skipped: 'timeout',
    runs: 0,
  })
  expect(seedLines(stderr).filter((line) => line.includes('Shrunk'))).toMatchInlineSnapshot(`
    [
      "     Shrunk  not tried, because the test timed out: each run of a smaller input can take the full timeout",
    ]
  `)

  // without repeats, a timeout has no replay, because the replay can take the full timeout too
  const single = await runSeededTests({
    'job.test.js': structure['job.test.js'].replace('random.int(0, 200)', 'random.int(100, 200)'),
  })
  expect(
    findTest(single.results, name)
      .attempts()
      .map(({ state, shrink }) => [state, shrink?.skipped]),
  ).toEqual([['failed', 'timeout']])
})

test('the summary shows the progress of a test that shrinks', async () => {
  const name = 'the queue keeps every job'
  const failed = await runSeededTests({ 'queue.test.js': slowQueueTests })
  const replaySeed = getFailedSeed(findTest(failed.results, name))

  const { stdout } = await runSeededTests(
    { 'queue.test.js': slowQueueTests },
    {
      reporters: [['default', { summary: true, summaryOptions: { threshold: 0 }, isTTY: true }]],
      $cliOptions: { replaySeed, shrink: true },
    },
    { preserveAnsi: true, tty: true },
  )
  const frames = Array.from(await renderString(stdout))
  const progress = frames.flatMap((frame) =>
    frame.split('\n').filter((line) => line.includes('shrinking:')),
  )
  expect(progress.length).toBeGreaterThan(0)
  expect(progress.at(-1)).toMatch(
    /^ {3}└── the queue keeps every job shrinking: \d+ runs, 15 → \d+ random values$/,
  )
})

test('a reporter receives the progress of a test that shrinks', async () => {
  const name = 'the queue keeps every job'
  const failed = await runSeededTests({ 'queue.test.js': slowQueueTests })
  const replaySeed = getFailedSeed(findTest(failed.results, name))

  const events: string[] = []
  const progress: TestShrinkProgress[] = []
  await runSeededTests(
    { 'queue.test.js': slowQueueTests },
    {
      reporters: [
        {
          onTestCaseShrink(testCase, value) {
            events.push(`onTestCaseShrink ${testCase.name}`)
            progress.push(value)
          },
          onTestCaseResult(testCase) {
            events.push(`onTestCaseResult ${testCase.name}`)
          },
        },
      ],
      $cliOptions: { replaySeed, shrink: true },
    },
  )
  expect(new Set(events)).toEqual(new Set([`onTestCaseShrink ${name}`, `onTestCaseResult ${name}`]))
  expect(events.at(-1)).toBe(`onTestCaseResult ${name}`)
  expect(progress[0]).toEqual({ runs: 0, values: 15, initialValues: 15 })
  expect(progress.length).toBeGreaterThan(1)
  for (const [index, { runs, values }] of progress.entries()) {
    expect(runs).toBeGreaterThanOrEqual(progress[index - 1]?.runs ?? 0)
    expect(values).toBeLessThanOrEqual(progress[index - 1]?.values ?? 15)
  }
})

test('`shrink` and `--replay-tape` check their values', async () => {
  const structure = { 'basic.test.js': `test('basic', () => {})` }
  // the stack has the names of dist chunks
  const tape = await runSeededTests(structure, {
    $cliOptions: { replaySeed: '0000000000000000', replayTape: 'not a tape' },
  })
  expect(tape.stderr.split('\n')[0]).toMatchInlineSnapshot(
    `"TypeError: The "--replay-tape" flag received a tape that is not valid: "not a tape"."`,
  )

  const time = await runSeededTests(structure, { $cliOptions: { shrink: -1 } })
  expect(time.stderr.split('\n')[0]).toMatchInlineSnapshot(
    `"TypeError: The "shrink" option expects a boolean or a time limit in milliseconds, received -1."`,
  )
})
