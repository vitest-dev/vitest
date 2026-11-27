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

// on Windows, the replay command quotes arguments for PowerShell
function normalizeQuotes(output: string): string {
  if (process.platform !== 'win32') {
    return output
  }
  return output.replace(/^ +Replay {2}.*$/gm, (command) =>
    command.replace(/"((?:[^"`]|`.)*)"/g, (_, value: string) => {
      return `'${value.replace(/`(.)/g, '$1').replace(/'/g, `'\\''`)}'`
    }),
  )
}

const networkTests = /* js */ `
import { expect, test } from 'vitest'

class SimulatedNetwork {
  constructor(random) {
    this.random = random
    this.queue = []
  }

  send(message) {
    const lost = this.random.bool(0.3)
    expect.sometimes(lost, 'a lost message')
    if (!lost) {
      this.queue.push(message)
    }
  }
}

function deliver(random) {
  const network = new SimulatedNetwork(random.fork('network'))
  for (const message of ['create', 'update', 'delete']) {
    network.send(message)
  }
  return network.queue
}

test('delivers the messages that are not lost', { repeats: 4 }, ({ random }) => {
  const delivered = deliver(random)
  expect.sometimes(delivered.length === 0, 'all messages lost')
  expect(delivered.length).toBeLessThanOrEqual(3)
})
`

test('a label that is false in every run fails the test at its first call, and the calls of helper code count', async () => {
  const { stderr, results } = await runSeededTests({ 'network.test.js': networkTests })
  const testCase = findTest(results, 'delivers the messages that are not lost')
  expect(testCase.result().state).toBe('failed')
  // every run passed, so no attempt has the error
  expect(testCase.attempts().map(({ state }) => state)).toEqual([
    'passed',
    'passed',
    'passed',
    'passed',
    'passed',
  ])
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  network.test.js > delivers the messages that are not lost
    NeverReachedError: expect.sometimes() was never true for "all messages lost" in 5 runs
     ❯ network.test.js:29:10
         27| test('delivers the messages that are not lost', { repeats: 4 }, ({ ran…
         28|   const delivered = deliver(random)
         29|   expect.sometimes(delivered.length === 0, 'all messages lost')
           |          ^
         30|   expect(delivered.length).toBeLessThanOrEqual(3)
         31| })

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('a test without repeats, or with --replay-seed, checks no labels', async () => {
  const withoutRepeats = await runSeededTests({
    'network.test.js': networkTests.replace('{ repeats: 4 }, ', ''),
  })
  expect(withoutRepeats.stderr).toBe('')
  expect(withoutRepeats.testTree()).toMatchInlineSnapshot(`
    {
      "network.test.js": {
        "delivers the messages that are not lost": "passed",
      },
    }
  `)

  const replay = await runSeededTests(
    { 'network.test.js': networkTests },
    { $cliOptions: { replaySeed: '6fbadd5eb90fcf71' } },
  )
  expect(replay.stderr).toBe('')
  expect(replay.testTree()).toMatchInlineSnapshot(`
    {
      "network.test.js": {
        "delivers the messages that are not lost": "passed",
      },
    }
  `)
})

test('the runs of seeds check the labels only in a test with repeats', async () => {
  const { errorTree } = await runSeededTests({
    'messages.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('a kept seed', { seeds: ['5f439498b04e109e'] }, ({ random }) => {
        const lost = random.bool(0.01)
        expect.sometimes(lost, 'a lost message')
        expect(typeof lost).toBe('boolean')
      })

      test('a kept seed and repeats', { repeats: 1, seeds: ['5f439498b04e109e'] }, ({ random }) => {
        const lost = random.bool(0.01)
        expect.sometimes(lost, 'a lost message')
        expect(typeof lost).toBe('boolean')
      })
    `,
  })
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "messages.test.js": {
        "a kept seed": "passed",
        "a kept seed and repeats": [
          "expect.sometimes() was never true for "a lost message" in 3 runs",
        ],
      },
    }
  `)
})

test('the errors of failed repeats and a label that was never true are shown together', async () => {
  const { stderr, results } = await runSeededTests(
    {
      'network.test.js': networkTests.replace(
        'expect(delivered.length).toBeLessThanOrEqual(3)',
        'expect(delivered).toEqual(["create", "update", "delete"])',
      ),
    },
    { shrink: false },
  )
  const testCase = findTest(results, 'delivers the messages that are not lost')
  expect(testCase.result().errors.map(({ message }) => message)).toMatchInlineSnapshot(`
    [
      "expected [ 'create', 'delete' ] to deeply equal [ 'create', 'update', 'delete' ]",
      "expected [ 'create' ] to deeply equal [ 'create', 'update', 'delete' ]",
      "expected [ 'create' ] to deeply equal [ 'create', 'update', 'delete' ]",
      "expected [ 'update', 'delete' ] to deeply equal [ 'create', 'update', 'delete' ]",
      "expect.sometimes() was never true for "all messages lost" in 5 runs",
    ]
  `)
  expect(normalizeQuotes(stderr)).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  network.test.js > delivers the messages that are not lost
    AssertionError: expected [ 'create', 'delete' ] to deeply equal [ 'create', 'update', 'delete' ]

    - Expected
    + Received

      [
        "create",
    -   "update",
        "delete",
      ]

     ❯ network.test.js:30:21
         28|   const delivered = deliver(random)
         29|   expect.sometimes(delivered.length === 0, 'all messages lost')
         30|   expect(delivered).toEqual(["create", "update", "delete"])
           |                     ^
         31| })
         32|

         Failed  4 of 5 runs
         Replay  vitest run network.test.js -t '^delivers the messages that are not lost$' --seed 0 --replay-seed fe55b20b11111e45

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

     FAIL  network.test.js > delivers the messages that are not lost
    NeverReachedError: expect.sometimes() was never true for "all messages lost" in 5 runs
     ❯ network.test.js:29:10
         27| test('delivers the messages that are not lost', { repeats: 4 }, ({ ran…
         28|   const delivered = deliver(random)
         29|   expect.sometimes(delivered.length === 0, 'all messages lost')
           |          ^
         30|   expect(delivered).toEqual(["create", "update", "delete"])
         31| })

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

    "
  `)
})

test('the hidden run of a seed that does not fail again does not count', async () => {
  const { stdout, results } = await runSeededTests({
    'balancer.test.js': /* js */ `
      import { expect, test } from 'vitest'

      const regions = ['us', 'eu', 'ap']
      // the balancer keeps its position from one run to the next
      let next = 0

      test('routes the request to the eu region', { repeats: 1 }, ({ random }) => {
        const region = regions[next++ % regions.length]
        console.log('region', region)
        // only the us region picks a replica, so the replay of a us request takes another path
        if (region === 'us') {
          random.int(1, 3)
        }
        expect.sometimes(region === 'ap', 'a request to ap')
        expect(region).toBe('eu')
      })
    `,
  })
  const testCase = findTest(results, 'routes the request to the eu region')
  // each failed seed runs 2 more times, and only the hidden third run goes to ap
  expect(stdout.match(/^region \w+$/gm)).toEqual([
    'region us',
    'region eu',
    'region us',
    'region eu',
  ])
  expect(testCase.result().errors.map(({ message }) => message)).toMatchInlineSnapshot(`
    [
      "expected 'us' to be 'eu' // Object.is equality",
      "expected 'us' to be 'eu' // Object.is equality",
      "expect.sometimes() was never true for "a request to ap" in 2 runs",
    ]
  `)
})

test('in concurrent tests, expect of the test context counts the call for its test', async () => {
  const { stderr, testTree } = await runSeededTests({
    'cache.test.js': /* js */ `
      import { test } from 'vitest'

      test.concurrent('reads a missing key', { repeats: 2 }, async ({ expect }) => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect.sometimes(false, 'a cache miss')
      })

      test.concurrent('reads a cached key', { repeats: 2 }, async ({ expect }) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        expect.sometimes(true, 'a cache hit')
      })
    `,
  })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  cache.test.js > reads a missing key
    NeverReachedError: expect.sometimes() was never true for "a cache miss" in 3 runs
     ❯ cache.test.js:6:16
          4|       test.concurrent('reads a missing key', { repeats: 2 }, async ({ …
          5|         await new Promise((resolve) => setTimeout(resolve, 20))
          6|         expect.sometimes(false, 'a cache miss')
           |                ^
          7|       })
          8|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "cache.test.js": {
        "reads a cached key": "passed",
        "reads a missing key": "failed",
      },
    }
  `)
})
