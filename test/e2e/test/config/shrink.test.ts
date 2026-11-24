import type { TestCase, TestModule, TestShrinkProgress } from 'vitest/node'
import { renderString } from 'ansivision'
import { expect, test } from 'vitest'
import { runInlineTests, runVitest } from '#test-utils'

// the inline snapshots have the seeds of the run seed 0, and the search is off by default
function runSeededTests(...[structure, config, ...rest]: Parameters<typeof runInlineTests>) {
  return runInlineTests(structure, { seed: 0, shrink: true, ...config }, ...rest)
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
    .replace(/(try|tries) \((\d+ms|\d+\.\d+s)/g, '$1 (<time>')
    .split('\n')
    .filter((line) =>
      /^ FAIL |^ +(Failed|Reproduced|Tape|Original|Shrunk|Values|Keep|Replay) {2}|^ {13}\S/.test(
        line,
      ),
    )
}

// the `Tapes` row of the summary and its next lines
function tapesSummary(stdout: string): string[] {
  const lines = stdout.split('\n')
  const start = lines.findIndex((line) => /^ +Tapes {2}/.test(line))
  if (start === -1) {
    return []
  }
  const end = lines.findIndex((line, index) => index > start && !line.startsWith(' '.repeat(13)))
  return lines.slice(start, end)
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
  const jobs = random.many('jobs', () => random.int(0, 1000))
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
  expect(stdout).toMatch('Shrinking each failed test for up to 10.00s')
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
      "   Original  AssertionError: expected [] to deeply equal [ 937, 927 ]",
      "     Shrunk  from 5 to 3 random values in 205 tries (<time>)",
      "     Values  random.many('jobs') → [ 501 ]",
      "       Keep  seeds: ['505ea19c93ba8e71:AQEAAwKr1arVAoT2goEI']",
      "     Replay  vitest run queue.test.js -t '^the queue keeps every job$' --seed 0 --replay-seed 505ea19c93ba8e71:AQEAAwKr1arVAoT2goEI",
    ]
  `)
  const shrink = testCase.attempts()[0].shrink
  expect(shrink).toMatchObject({ shrunk: true, reproduced: true, values: 3 })

  const replay = await runSeededTests(
    { 'queue.test.js': queueTests },
    { $cliOptions: { replaySeed: `${replaySeed}:${shrink?.tape}` } },
  )
  const replayed = findTest(replay.results, name)
  expect(replayed.result().errors?.map((error) => error.message)).toEqual(
    testCase.result().errors?.map((error) => error.message),
  )
  expect(replay.stdout).toMatch(`Replaying seed "${replaySeed}" with its tape`)
  expect(replay.stdout).not.toMatch('Shrinking')
})

test('a failed test shrinks with `shrink: true`', async () => {
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
      "   Original  AssertionError: expected [] to deeply equal [ 937, 927 ]",
      "     Shrunk  from 5 to 3 random values in 205 tries (<time>)",
      "     Values  random.many('jobs') → [ 501 ]",
      "       Keep  seeds: ['505ea19c93ba8e71:AQEAAwKr1arVAoT2goEI']",
      "     Replay  vitest run queue.test.js -t '^the queue keeps every job$' --seed 0 --replay-seed 505ea19c93ba8e71:AQEAAwKr1arVAoT2goEI",
    ]
  `)
  // the replay of the failed seed records the random values for the search
  expect(testCase.attempts().map(({ state, retryIndex }) => [state, retryIndex])).toEqual([
    ['failed', 0],
    ['failed', 1],
  ])
  expect(testCase.attempts()[1].shrink).toMatchObject({ shrunk: true, reproduced: true })
})

test('the search is off by default', async () => {
  const name = 'the queue keeps every job'
  const formatAttempts = (testCase: TestCase) =>
    testCase
      .attempts()
      .map(
        ({ state, repeatIndex, retryIndex, shrink }) =>
          `${state} repeat ${repeatIndex} retry ${retryIndex}${shrink ? ' searched' : ''}`,
      )
  const { stderr, results } = await runInlineTests({ 'queue.test.js': queueTests }, { seed: 0 })
  expect(formatAttempts(findTest(results, name))).toMatchInlineSnapshot(`
    [
      "failed repeat 0 retry 0",
    ]
  `)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  queue.test.js > the queue keeps every job",
      "     Replay  vitest run queue.test.js -t '^the queue keeps every job$' --seed 0 --replay-seed 505ea19c93ba8e71",
    ]
  `)

  // each failed seed of a test with repeats still runs 1 more time
  const repeated = await runInlineTests(
    { 'queue.test.js': withTestOptions(queueTests, '{ repeats: 3 }') },
    { seed: 0 },
  )
  expect(formatAttempts(findTest(repeated.results, name))).toMatchInlineSnapshot(`
    [
      "failed repeat 0 retry 0",
      "failed repeat 0 retry 1",
      "passed repeat 1 retry 0",
      "failed repeat 2 retry 0",
      "failed repeat 2 retry 1",
      "failed repeat 3 retry 0",
      "failed repeat 3 retry 1",
    ]
  `)
})

test.for([
  ['the config option', { shrink: true }, queueTests],
  ['the test option', {}, withTestOptions(queueTests, '{ shrink: true }')],
  [
    'a tag',
    { tags: [{ name: 'simulation', shrink: true }] },
    withTestOptions(queueTests, "{ tags: ['simulation'] }"),
  ],
  ['--shrink', { $cliOptions: { shrink: true } }, queueTests],
] as const)('%s turns the search on', async ([, config, source]) => {
  const { results } = await runInlineTests({ 'queue.test.js': source }, { seed: 0, ...config })
  const testCase = findTest(results, 'the queue keeps every job')
  expect(testCase.attempts().map(({ state, shrink }) => [state, shrink?.shrunk])).toEqual([
    ['failed', undefined],
    ['failed', true],
  ])
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

function withTestOptions(source: string, options: string) {
  return source.replace(/test\('the queue keeps every job', (async )?\(/, (match) =>
    match.replace(', ', `, ${options}, `),
  )
}

// a limit of 1 ms stops the search of the slow queue after its first run, 60 s let it finish
test.for([
  [
    'the test option sets the limit',
    {},
    withTestOptions(slowQueueTests, '{ shrink: 1 }'),
    'stopped at the limit',
  ],
  [
    'a describe passes the limit to its tests',
    {},
    // the name of the describe changes the seed, so this test fails for every seed
    /* js */ `
      import { describe, expect, test } from 'vitest'

      describe('queue', { shrink: 1 }, () => {
        test('the queue keeps every job', async ({ random }) => {
          await new Promise((resolve) => setTimeout(resolve, 5))
          expect(random.int(1, 1000)).toBe(0)
        })
      })
    `,
    'stopped at the limit',
  ],
  [
    'a tag passes the limit to its tests',
    { tags: [{ name: 'simulation', shrink: 1 }] },
    withTestOptions(slowQueueTests, "{ tags: ['simulation'] }"),
    'stopped at the limit',
  ],
  [
    'the test option wins over the config',
    { shrink: 1 },
    withTestOptions(queueTests, '{ shrink: 60_000 }'),
    'finished',
  ],
  [
    'the test option turns the search on when the config turns it off',
    { shrink: false },
    withTestOptions(queueTests, '{ shrink: 60_000 }'),
    'finished',
  ],
  [
    '--shrink <time> wins over the test option',
    { $cliOptions: { shrink: 1 } },
    withTestOptions(slowQueueTests, '{ shrink: 60_000 }'),
    'stopped at the limit',
  ],
  [
    '`shrink: true` in the test keeps the limit of the config',
    { shrink: 1 },
    withTestOptions(slowQueueTests, '{ shrink: true }'),
    'stopped at the limit',
  ],
  [
    '--no-shrink wins over `shrink: true` in the test',
    { $cliOptions: { shrink: false } },
    withTestOptions(queueTests, '{ shrink: true }'),
    'no search',
  ],
  [
    '--no-shrink wins over the test option',
    { $cliOptions: { shrink: false } },
    withTestOptions(queueTests, '{ shrink: 60_000 }'),
    'no search',
  ],
  [
    '--shrink without a time keeps the limit of the test',
    { $cliOptions: { shrink: true } },
    withTestOptions(slowQueueTests, '{ shrink: 1 }'),
    'stopped at the limit',
  ],
  [
    'shrink: false in the test wins over --shrink <time>',
    { $cliOptions: { shrink: 60_000 } },
    withTestOptions(queueTests, '{ shrink: false }'),
    'no search',
  ],
] as const)('%s', async ([, config, source, expected]) => {
  const { results } = await runSeededTests({ 'queue.test.js': source }, config)
  const testCase = [...results[0].children.allTests()][0]
  expect(testCase.result().state).toBe('failed')
  const shrink = testCase.attempts().find((attempt) => attempt.shrink)?.shrink
  expect(!shrink ? 'no search' : shrink.timedOut ? 'stopped at the limit' : 'finished').toBe(
    expected,
  )
})

test('the test option rejects a time limit that is not valid', async () => {
  const { errorTree } = await runSeededTests({
    'queue.test.js': withTestOptions(queueTests, '{ shrink: 0 }'),
  })
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "queue.test.js": {
        "__module_errors__": [
          "The "shrink" option expects a boolean or a time limit in milliseconds, received 0.",
        ],
      },
    }
  `)
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

const orderTests = /* js */ `
  import { expect, test } from 'vitest'

  function createOrder(items) {
    return { id: crypto.randomUUID(), total: items.reduce((sum, item) => sum + item.price, 0) }
  }

  test('an order has the total of its items', { fakeRandom: true }, () => {
    const order = createOrder([{ price: 10 }, { price: 5 }])
    expect(order.total).toBe(16)
  })
`

test('a failed test without repeats that read only fake values gets no search', async () => {
  const { stderr, results } = await runSeededTests({ 'order.test.js': orderTests })
  const testCase = findTest(results, 'an order has the total of its items')
  expect(testCase.attempts().map(({ state }) => state)).toEqual(['failed'])
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  order.test.js > an order has the total of its items",
      "     Replay  vitest run order.test.js -t '^an order has the total of its items$' --seed 0 --replay-seed 96afa452dd5b4629",
    ]
  `)

  const retried = await runSeededTests({
    'order.test.js': orderTests.replace('{ fakeRandom: true }', '{ fakeRandom: true, retry: 1 }'),
  })
  const retriedCase = findTest(retried.results, 'an order has the total of its items')
  expect(retriedCase.attempts().map(({ state, shrink }) => [state, shrink])).toEqual([
    ['failed', undefined],
    ['failed', undefined],
  ])
})

test.for([
  ['repeats', orderTests.replace('{ fakeRandom: true }', '{ fakeRandom: true, repeats: 1 }')],
  [
    'seeds',
    orderTests.replace('{ fakeRandom: true }', "{ fakeRandom: true, seeds: ['96afa452dd5b4629'] }"),
  ],
] as const)('%s turns on the search of fake values', async ([, source]) => {
  const { results } = await runSeededTests({ 'order.test.js': source })
  const testCase = findTest(results, 'an order has the total of its items')
  expect(testCase.attempts().filter((attempt) => attempt.shrink?.reproduced)).toHaveLength(1)
})

const cartTests = /* js */ `
  import { expect, test as base } from 'vitest'

  const test = base.extend({
    cart: async ({}, use) => {
      await use({ items: Math.floor(Math.random() * 10) })
    },
  })

  test.aroundEach(async (runTest, { cart }) => {
    await runTest()
  })

  test('a cart has at most 5 items', { fakeRandom: true, repeats: 9 }, ({ cart }) => {
    expect(cart.items).toBeLessThanOrEqual(5)
  })
`

test('the search and the replay change the values that a fixture of aroundEach reads', async () => {
  const { stderr } = await runSeededTests({ 'cart.test.js': cartTests })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  cart.test.js > a cart has at most 5 items",
      "     Failed  4 of 10 runs",
      "   Original  AssertionError: expected 7 to be less than or equal to 5",
      "     Shrunk  to smaller random values in 83 tries (<time>)",
      "     Values  Math.random() → 0.6000000014901161 (cart.test.js:6:42)",
      "       Keep  seeds: ['bc7a8070e62420ee:AQEBDnZpdGVzdDpnbG9iYWxzAgGgs-bMCQ']",
      "     Replay  vitest run cart.test.js -t '^a cart has at most 5 items$' --seed 0 --replay-seed bc7a8070e62420ee:AQEBDnZpdGVzdDpnbG9iYWxzAgGgs-bMCQ",
    ]
  `)

  // the replay command has PowerShell quotes on Windows, and the `Keep` line has none
  const replaySeed = /seeds: \['([^']+)'\]/.exec(stderr)![1]
  const replayed = await runSeededTests(
    { 'cart.test.js': cartTests },
    { $cliOptions: { replaySeed } },
  )
  expect(replayed.errorTree()).toMatchInlineSnapshot(`
    {
      "cart.test.js": {
        "a cart has at most 5 items": [
          "expected 6 to be less than or equal to 5",
        ],
      },
    }
  `)
})

test.for([
  [
    'a time limit of the test',
    {},
    orderTests.replace('{ fakeRandom: true }', '{ fakeRandom: true, shrink: 5000 }'),
  ],
  ['--shrink', { $cliOptions: { shrink: true } }, orderTests],
] as const)('%s does not turn on the search of fake values', async ([, config, source]) => {
  const { results } = await runSeededTests({ 'order.test.js': source }, config)
  const testCase = findTest(results, 'an order has the total of its items')
  expect(testCase.attempts().map(({ state, shrink }) => [state, shrink])).toEqual([
    ['failed', undefined],
  ])
})

test('a failed test without repeats searches the start time of a now range', async () => {
  const { stderr } = await runSeededTests({
    'invoice.test.js': /* js */ `
      import { expect, test } from 'vitest'

      const fakeTimers = {
        now: { min: new Date('2024-01-01T00:00:00.000Z'), max: new Date('2025-12-31T23:59:59.999Z') },
      }

      test('an invoice is from the year of the contract', { fakeRandom: true, fakeTimers }, () => {
        const invoice = { id: crypto.randomUUID(), year: new Date().getUTCFullYear() }
        expect(invoice.year).toBe(2023)
      })
    `,
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  invoice.test.js > an invoice is from the year of the contract",
      "   Original  AssertionError: expected 2025 to be 2023 // Object.is equality",
      "     Shrunk  to smaller random values in 10 tries (<time>)",
      "     Values  crypto.randomUUID() → '00000000-0000-4000-8000-000000000000' (invoice.test.js:9:38)",
      "       Keep  seeds: ['24cae1deee7851bb:AQICDnZpdGVzdDpnbG9iYWxzDHZpdGVzdDpjbG9jawgAAQ52aXRlc3Q6Z2xvYmFscwQA']",
      "     Replay  vitest run invoice.test.js -t '^an invoice is from the year of the contract$' --seed 0 --replay-seed 24cae1deee7851bb:AQICDnZpdGVzdDpnbG9iYWxzDHZpdGVzdDpjbG9jawgAAQ52aXRlc3Q6Z2xvYmFscwQA",
    ]
  `)
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
      " Reproduced  no, the replay passed, so the test depends on more than its seed",
      "             the failed run and the replay read the same random values",
      "     Replay  vitest run cache.test.js -t '^the price comes from the cache$' --seed 0 --replay-seed ba380723df264372",
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
        const jobs = random.many('jobs', () => random.int(0, 1000))
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
      "   Original  AssertionError: expected [] to deeply equal [ 937, 927 ]",
      "     Shrunk  from 5 to 3 random values in 205 tries (<time>)",
      "     Values  random.many('jobs') → [ 501 ]",
      "       Keep  seeds: ['505ea19c93ba8e71:AQEAAwKr1arVAoT2goEI']",
      "     Replay  vitest run queue.test.js -t '^the queue keeps every job$' --seed 0 --replay-seed 505ea19c93ba8e71:AQEAAwKr1arVAoT2goEI",
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
      "     Failed  4 of 50 runs",
      "   Original  AssertionError: too heavy: expected 940 to be less than 900",
      "     Shrunk  to smaller random values in 85 tries (<time>)",
      "     Values  random.int(1, 1000) → 900 (box.test.js:5:31)",
      "             random.int(1, 100) → 1 (box.test.js:6:29)",
      "       Keep  seeds: ['e52e7185be98fee4:AQEAAgGluJOxDg']",
      "     Replay  vitest run box.test.js -t '^an order fits in 1 box$' --seed 0 --replay-seed e52e7185be98fee4:AQEAAgGluJOxDg",
      " FAIL  box.test.js > an order fits in 1 box",
      "     Failed  3 of 50 runs",
      "   Original  AssertionError: too large: expected 96 to be less than 95",
      "     Shrunk  to smaller random values in 83 tries (<time>)",
      "     Values  random.int(1, 1000) → 1 (box.test.js:5:31)",
      "             random.int(1, 100) → 95 (box.test.js:6:29)",
      "       Keep  seeds: ['47ddd65ca7753442:AQEAAgIAsK2PhQ8']",
      "     Replay  vitest run box.test.js -t '^an order fits in 1 box$' --seed 0 --replay-seed 47ddd65ca7753442:AQEAAgIAsK2PhQ8",
    ]
  `)
})

test('a failure that reaches the `bail` limit does not start its search', async () => {
  const { results } = await runSeededTests(
    {
      'queue.test.js': `${queueTests}\ntest('the queue is empty at the start', () => {})\n`,
    },
    { bail: 1 },
  )
  const testCase = findTest(results, 'the queue keeps every job')
  expect(testCase.result().state).toBe('failed')
  expect(testCase.attempts().map((attempt) => attempt.shrink)).toEqual([undefined, undefined])
  expect(findTest(results, 'the queue is empty at the start').result().state).toBe('skipped')
})

test('an entry with a tape in `seeds` runs the smallest input on every run', async () => {
  // the seed and the tape of the first test
  const entry = '505ea19c93ba8e71:AQEAAwKr1arVAoT2goEI'
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
    [0, 0, '505ea19c93ba8e71'],
    [0, 1, '505ea19c93ba8e71'],
  ])
  expect(failed.map((attempt) => attempt.errors?.[0].message)).toEqual([
    'expected [] to deeply equal [ 501 ]',
    'expected [] to deeply equal [ 501 ]',
  ])
  expect(seedLines(stderr).filter((line) => line.includes('Replay'))).toMatchInlineSnapshot(`
    [
      "     Replay  vitest run queue.test.js -t '^the queue keeps every job$' --seed 0 --replay-seed 505ea19c93ba8e71:AQEAAwKr1arVAoT2goEI",
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
        seeds: ['505ea19c93ba8e71:AQEAAwKr1arVAoT2goEI'],
      }, ({ random }) => {
        const jobs = random.many('jobs', () => random.int(0, 1000))
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
  expect(seedLines(stderr).filter((line) => line.includes('Tape'))).toMatchInlineSnapshot(`
    [
      "       Tape  does not fit the code",
    ]
  `)
  const testCase = findTest(results, 'the queue keeps every job')
  const failed = testCase.attempts().filter((attempt) => attempt.state === 'failed')
  // the jobs still come from the tape, the new values come from the seed
  expect(failed.map((attempt) => attempt.errors?.[0].message)).toEqual([
    'expected [] to deeply equal [ 501 ]',
    'expected [] to deeply equal [ 501 ]',
  ])
})

test('a kept tape names each fork that does not fit the code', async () => {
  const { stderr } = await runSeededTests({
    'fee.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('the fee is not larger than the amount', {
        seeds: ['a433d453fcbb6fda:AQEBBWFsaWNlAgIAmbPmzAE'],
      }, ({ random }) => {
        // the fork was 'alice' when the tape was kept
        const sender = random.fork('sender')
        const amount = sender.int(0, 9)
        const fee = sender.int(0, 9)
        expect(fee, \`amount \${amount}, fee \${fee}\`).toBeLessThanOrEqual(amount)
      })
    `,
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  fee.test.js > the fee is not larger than the amount",
      "     Failed  1 of 2 runs: kept seed a433d453fcbb6fda",
      "       Tape  does not fit the code",
      "             random.fork('alice') read 0 random values, and the tape has 2",
      "             random.fork('sender') read 2 random values, and the tape has 0",
      "     Replay  vitest run fee.test.js -t '^the fee is not larger than the amount$' --seed 0 --replay-seed a433d453fcbb6fda:AQEBBWFsaWNlAgIAmbPmzAE",
    ]
  `)
})

test('a kept tape prints 3 forks that do not fit and counts the others', async () => {
  const { stderr } = await runSeededTests({
    'fee.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('the fee is not larger than the amount', {
        seeds: ['a433d453fcbb6fda:AQEBBWFsaWNlAgIAmbPmzAE'],
      }, ({ random }) => {
        // each party got its own fork after the tape was kept
        const [amount, fee, tax] = ['sender', 'bank', 'state'].map((party) =>
          random.fork(party).int(0, 9),
        )
        expect(fee + tax, \`amount \${amount}, fee \${fee}, tax \${tax}\`).toBeLessThanOrEqual(amount)
      })
    `,
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  fee.test.js > the fee is not larger than the amount",
      "     Failed  2 of 2 runs: kept seed a433d453fcbb6fda",
      "       Tape  does not fit the code",
      "             random.fork('alice') read 0 random values, and the tape has 2",
      "             random.fork('sender') read 1 random value, and the tape has 0",
      "             random.fork('bank') read 1 random value, and the tape has 0",
      "             and 1 more",
      "     Replay  vitest run fee.test.js -t '^the fee is not larger than the amount$' --seed 0 --replay-seed a433d453fcbb6fda:AQEBBWFsaWNlAgIAmbPmzAE",
    ]
  `)
})

// the bug of the queue is fixed
const fixedQueueTests = queueTests.replace(
  'return jobs.filter((size) => size <= 500)',
  'return jobs',
)
// the code reads 1 more random value than the tape has
const changedQueueTests = fixedQueueTests.replace(
  `const jobs = random.many('jobs', () => random.int(0, 1000))`,
  `const jobs = random.many('jobs', () => random.int(0, 1000))\n  random.bool()`,
)

test('a replayed tape that passes says that it did not reproduce the failure', async () => {
  const replaySeed = '505ea19c93ba8e71:AQEAAwKr1arVAoT2goEI'
  const fixed = await runSeededTests(
    { 'queue.test.js': fixedQueueTests },
    { $cliOptions: { replaySeed } },
  )
  expect(findTest(fixed.results, 'the queue keeps every job').result().state).toBe('passed')
  expect(tapesSummary(fixed.stdout)).toMatchInlineSnapshot(`
    [
      "      Tapes  1 passed with the same random values",
      "             ↳ queue.test.js",
      "               · the queue keeps every job",
      "             the failure does not occur now",
    ]
  `)

  const changed = await runSeededTests(
    { 'queue.test.js': changedQueueTests },
    { $cliOptions: { replaySeed } },
  )
  expect(tapesSummary(changed.stdout)).toMatchInlineSnapshot(`
    [
      "      Tapes  1 does not fit the code",
      "             ↳ queue.test.js",
      "               · the queue keeps every job: random read 4 random values, and the tape has 3",
      "             the code changed after the search, so the tape does not test the original input",
    ]
  `)

  // a replayed tape that still fails needs no note
  const failed = await runSeededTests(
    { 'queue.test.js': queueTests },
    { $cliOptions: { replaySeed } },
  )
  expect(tapesSummary(failed.stdout)).toEqual([])
})

test('a kept tape that does not fit the code any more is reported', async () => {
  const { stdout, results } = await runSeededTests({
    'queue.test.js': changedQueueTests.replace(
      "test('the queue keeps every job', ({ random }) => {",
      "test('the queue keeps every job', { seeds: ['505ea19c93ba8e71:AQEAAwKr1arVAoT2goEI'] }, ({ random }) => {",
    ),
  })
  expect(findTest(results, 'the queue keeps every job').result().state).toBe('passed')
  expect(tapesSummary(stdout)).toMatchInlineSnapshot(`
    [
      "      Tapes  1 does not fit the code",
      "             ↳ queue.test.js",
      "               · the queue keeps every job (505ea19c93ba8e71): random read 4 random values, and the tape has 3",
      "             the code changed after the search, so the tape does not test the original input",
    ]
  `)

  // a kept tape that fits the code is a regression test that passes without a note
  const fits = await runSeededTests({
    'queue.test.js': fixedQueueTests.replace(
      "test('the queue keeps every job', ({ random }) => {",
      "test('the queue keeps every job', { seeds: ['505ea19c93ba8e71:AQEAAwKr1arVAoT2goEI'] }, ({ random }) => {",
    ),
  })
  expect(tapesSummary(fits.stdout)).toEqual([])
})

test('an entry with a tape that is not valid throws an error', async () => {
  const { stderr } = await runSeededTests({
    'queue.test.js': queueTests.replace(
      "test('the queue keeps every job', ({ random }) => {",
      "test('the queue keeps every job', { seeds: ['505ea19c93ba8e71:not-a-tape!'] }, ({ random }) => {",
    ),
  })
  expect(stderr.split('\n').filter((line) => line.startsWith('TypeError'))).toMatchInlineSnapshot(`
    [
      "TypeError: The tape of the seed "505ea19c93ba8e71" in "seeds" is not valid. Copy the entry from the "Keep" line of a failed test.",
    ]
  `)

  // the message shows only the start of a long entry
  const long = await runSeededTests({
    'queue.test.js': queueTests.replace(
      "test('the queue keeps every job', ({ random }) => {",
      `test('the queue keeps every job', { seeds: ['42:${'A'.repeat(300)}'] }, ({ random }) => {`,
    ),
  })
  expect(
    long.stderr
      .split('\n')
      .filter((line) => line.startsWith('TypeError'))
      .map((line) => line.replace(/A{197}/, '<197 A>')),
  ).toMatchInlineSnapshot(`
    [
      "TypeError: A seed in "seeds" must be a string of 16 hexadecimal digits, received "42:<197 A>… (303 characters)".",
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
    repeats: 20,
    $cliOptions: { replaySeed },
  })
  expect(findTest(results, name).result().errors?.[0].message).toMatchInlineSnapshot(
    `"expected '00000070' not to match '7'"`,
  )
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  coupon.test.js > a coupon code has no 7",
      "   Original  AssertionError: expected '06356474' not to match '7'",
      "     Shrunk  to smaller random values in 125 tries (<time>)",
      "     Values  Math.random() → 0 (coupon.test.js:6:70), 6 times",
      "             Math.random() → 0.7000000029802322 (coupon.test.js:6:70)",
      "             Math.random() → 0 (coupon.test.js:6:70)",
      "       Keep  seeds: ['cb60ca501923991c:AQEBDnZpdGVzdDpnbG9iYWxzEA0AAAAAAAAAAAAAAADA5syZCw']",
      "     Replay  vitest run coupon.test.js -t '^a coupon code has no 7$' --seed 0 --replay-seed cb60ca501923991c:AQEBDnZpdGVzdDpnbG9iYWxzEA0AAAAAAAAAAAAAAADA5syZCw",
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
    repeats: 20,
    $cliOptions: { replaySeed },
  })
  expect(seedLines(stderr).filter((line) => line.includes('Values'))).toMatchInlineSnapshot(`
    [
      "     Values  crypto.getRandomValues(Uint8Array(6)) → Uint8Array [ 0, 0, 0, 0, 80, 0 ] (invite.test.js:7:30)",
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
      "     Shrunk  to smaller random values in 320 tries (<time>)",
      "     Values  random.span('order') → { quantity: 5, price: 47 }",
      "             random.int(0, 20) → 16 (orders.test.js:20:33)",
      "       Keep  seeds: ['0250aad09a8f1a79:AQEAAwPkzJmzBrCeiq4HwOGwmAw']",
      "     Replay  vitest run orders.test.js -t '^finds the orders above the limit$' --seed 0 --replay-seed 0250aad09a8f1a79:AQEAAwPkzJmzBrCeiq4HwOGwmAw",
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
      "     Shrunk  to smaller random values in 97 tries (<time>)",
      "     Values  random.span('profile') → { name: '', email: 'alice@example.com', city: 'Berlin', …(2) }",
      "       Keep  seeds: ['40a5c48ab7866a69:AQEABQGq1arVCg']",
      "     Replay  vitest run profile.test.js -t '^a profile has a name$' --seed 0 --replay-seed 40a5c48ab7866a69:AQEABQGq1arVCg",
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
      "   Original  AssertionError: expected 5 to be less than or equal to 3",
      "     Shrunk  from 5 to 4 random values in 95 tries (<time>)",
      "     Values  random.bool(0.2) → false (worker.test.js:6:24), 3 times",
      "             random.bool(0.2) → true (worker.test.js:6:24)",
      "       Keep  seeds: ['7e63bfa810e9f9f7:AQEABAQAAADNmbPmDA']",
      "     Replay  vitest run worker.test.js -t '^a worker gets a job in 3 tries$' --seed 0 --replay-seed 7e63bfa810e9f9f7:AQEABAQAAADNmbPmDA",
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
  expect(stdout.split('\n').filter((line) => line.startsWith('jobs'))).toEqual(['jobs 2', 'jobs 1'])
  expect(testCase.annotations().map((annotation) => annotation.message)).toEqual([
    '2 jobs',
    '1 jobs',
  ])
  expect(
    testCase.artifacts().map((artifact) => ('count' in artifact ? artifact.count : undefined)),
  ).toEqual([2, 1])
})

test('the snapshots are of the failed attempt, not of the smallest input', async () => {
  const structure = {
    'queue.test.js': queueTests.replace(
      '  expect(enqueue(jobs)).toEqual(jobs)',
      `  expect(jobs).toMatchSnapshot()
  expect(jobs.length).toMatchInlineSnapshot()
  if (jobs.length === 1) {
    expect(jobs[0]).toMatchSnapshot('one job')
  }
  expect(enqueue(jobs)).toEqual(jobs)`,
    ),
  }
  const { fs, stderr, errorTree } = await runSeededTests(structure, { update: 'new' })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  queue.test.js > the queue keeps every job",
      "   Original  AssertionError: expected [] to deeply equal [ 937, 927 ]",
      "     Shrunk  from 5 to 3 random values in 205 tries (<time>)",
      "     Values  random.many('jobs') → [ 501 ]",
      "       Keep  seeds: ['505ea19c93ba8e71:AQEAAwKr1arVAoT2goEI']",
      "     Replay  vitest run queue.test.js -t '^the queue keeps every job$' --seed 0 --replay-seed 505ea19c93ba8e71:AQEAAwKr1arVAoT2goEI",
    ]
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "queue.test.js": {
        "the queue keeps every job": [
          "expected [] to deeply equal [ 501 ]",
        ],
      },
    }
  `)
  const snapshotFile = fs.readFile('__snapshots__/queue.test.js.snap')
  expect(snapshotFile).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`the queue keeps every job 1\`] = \`
    [
      937,
      927,
    ]
    \`;
    "
  `)
  expect(fs.readFile('queue.test.js')).toMatchInlineSnapshot(`
    "
    import { expect, test } from 'vitest'

    // a queue that drops the jobs above its size limit
    function enqueue(jobs) {
      return jobs.filter((size) => size <= 500)
    }

    test('the queue keeps every job', ({ random }) => {
      const jobs = random.many('jobs', () => random.int(0, 1000))
      expect(jobs).toMatchSnapshot()
      expect(jobs.length).toMatchInlineSnapshot(\`2\`)
      if (jobs.length === 1) {
        expect(jobs[0]).toMatchSnapshot('one job')
      }
      expect(enqueue(jobs)).toEqual(jobs)
    })
    "
  `)

  const rerun = await runVitest({ root: fs.root, seed: 0, update: 'none' })
  expect(rerun.errorTree()).toMatchInlineSnapshot(`
    {
      "queue.test.js": {
        "the queue keeps every job": [
          "expected [] to deeply equal [ 937, 927 ]",
        ],
      },
    }
  `)

  const updated = await runVitest({ root: fs.root, seed: 0, update: 'all' })
  expect(updated.stdout.split('\n').filter((line) => line.includes('Snapshots'))).toEqual([])
  expect(fs.readFile('__snapshots__/queue.test.js.snap')).toBe(snapshotFile)
})

const lateErrorTests = {
  'queue.test.js': queueTests.replace(
    '  expect(enqueue(jobs)).toEqual(jobs)',
    `  // only the runs of smaller inputs have no jobs
  if (!jobs.length) {
    setTimeout(() => {
      throw new Error('the empty queue sent a late report')
    }, 20)
  }
  expect(enqueue(jobs)).toEqual(jobs)`,
  ).concat(`
test('next test', async () => {
  await new Promise((resolve) => setTimeout(resolve, 200))
})
`),
}

function getLateErrorLines(stderr: string): string[] {
  return stderr
    .split('\n')
    .filter((line) => /^(Vitest caught|Error: |The last test|Vitest ran|The same error)/.test(line))
}

test('the late errors of the runs of smaller inputs are 1 error', async () => {
  const { stderr, errorTree } = await runSeededTests(lateErrorTests)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "__unhandled_errors__": [
        "the empty queue sent a late report",
      ],
      "queue.test.js": {
        "next test": "passed",
        "the queue keeps every job": [
          "expected [] to deeply equal [ 501 ]",
        ],
      },
    }
  `)
  expect(getLateErrorLines(stderr)).toMatchInlineSnapshot(`
    [
      "Vitest caught 1 unhandled error during the test run.",
      "Error: the empty queue sent a late report",
      "The last test to run before this error was "next test". This means either:",
      "Vitest ran "the queue keeps every job" with inputs that the report does not show, for example in the search for a smaller input. The error can come from one of these runs.",
      "The same error was thrown 99 times at this place.",
    ]
  `)
})

test('the late errors of 2 projects with the same file are 2 errors', async () => {
  const { stderr } = await runSeededTests(
    {
      ...lateErrorTests,
      'vitest.config.js': {
        test: { projects: [{ test: { name: 'a' } }, { test: { name: 'b' } }] },
      },
    },
    { $cliOptions: { replaySeed: '505ea19c93ba8e71' } },
  )
  expect(getLateErrorLines(stderr)).toMatchInlineSnapshot(`
    [
      "Vitest caught 2 unhandled errors during the test run.",
      "Error: the empty queue sent a late report",
      "The last test to run before this error was "next test". This means either:",
      "Vitest ran "the queue keeps every job" with inputs that the report does not show, for example in the search for a smaller input. The error can come from one of these runs.",
      "The same error was thrown 99 times at this place.",
      "Error: the empty queue sent a late report",
      "The last test to run before this error was "next test". This means either:",
      "Vitest ran "the queue keeps every job" with inputs that the report does not show, for example in the search for a smaller input. The error can come from one of these runs.",
      "The same error was thrown 99 times at this place.",
    ]
  `)
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

test('the duration of a test does not include the search', async () => {
  const { stdout, results } = await runSeededTests({
    'export.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('the export has fewer than 100 rows', { repeats: 3 }, async ({ random }) => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(random.int(0, 1000)).toBeLessThan(100)
      })
    `,
  })
  const testCase = findTest(results, 'the export has fewer than 100 rows')
  const search = testCase
    .attempts()
    .reduce((sum, attempt) => sum + (attempt.shrink?.duration ?? 0), 0)
  // the search runs the test more times than the repeats and the replay
  expect(testCase.diagnostic()!.duration).toBeLessThan(search)
  const line = stdout.split('\n').find((line) => line.includes('fewer than 100 rows'))
  expect(line?.replace(/\d+(\.\d+)?(ms|s)/g, '<time>')).toMatchInlineSnapshot(
    `" × export.test.js > the export has fewer than 100 rows <time> (repeat x3) (search <time>)"`,
  )
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
  expect(findTest(results, name).attempts()[0].shrink?.tape?.length).toBeGreaterThan(200)
  expect(
    seedLines(stderr)
      .slice(-3)
      .map((line) => line.replace(/\d+ characters/, '<count> characters')),
  ).toMatchInlineSnapshot(`
    [
      "       Keep  seeds: ['0000000000000000']",
      "     Replay  vitest run sum.test.js -t '^the sum is small$' --seed 0 --replay-seed 0000000000000000",
      "             the tape of the smallest input has <count> characters, so the command searches again",
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
      "     Shrunk  not tried, because the test timed out",
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
    /^ {3}└── the queue keeps every job shrinking: \d+ runs, 5 → \d+ random values$/,
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
  expect(progress[0]).toEqual({ runs: 0, values: 5, initialValues: 5 })
  expect(progress.length).toBeGreaterThan(1)
  for (const [index, { runs, values }] of progress.entries()) {
    expect(runs).toBeGreaterThanOrEqual(progress[index - 1]?.runs ?? 0)
    expect(values).toBeLessThanOrEqual(progress[index - 1]?.values ?? 5)
  }
})

test('`shrink` and `--replay-seed` check their values', async () => {
  const structure = { 'basic.test.js': `test('basic', () => {})` }
  // the stack has the names of dist chunks
  const tape = await runSeededTests(structure, {
    $cliOptions: { replaySeed: '0000000000000000:not a tape' },
  })
  expect(tape.stderr.split('\n')[0]).toMatchInlineSnapshot(
    `"TypeError: The "--replay-seed" flag received a tape that is not valid: "not a tape"."`,
  )

  const seed = await runSeededTests(structure, { $cliOptions: { replaySeed: '42:AQA' } })
  expect(seed.stderr.split('\n')[0]).toMatchInlineSnapshot(
    `"TypeError: The "--replay-seed" flag must have 16 hexadecimal digits, received "42:AQA"."`,
  )

  // the message shows only the start of a long tape
  const long = await runSeededTests(structure, {
    $cliOptions: { replaySeed: `0000000000000000:${'x'.repeat(300)}` },
  })
  expect(long.stderr.split('\n')[0].replace(/x{200}/, '<200 x>')).toMatchInlineSnapshot(
    `"TypeError: The "--replay-seed" flag received a tape that is not valid: "<200 x>… (300 characters)"."`,
  )

  const time = await runSeededTests(structure, { $cliOptions: { shrink: -1 } })
  expect(time.stderr.split('\n')[0]).toMatchInlineSnapshot(
    `"TypeError: The "shrink" option expects a boolean or a time limit in milliseconds, received -1."`,
  )
})
