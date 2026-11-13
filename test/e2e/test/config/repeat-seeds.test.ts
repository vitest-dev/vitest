import type { UserConsoleLog } from 'vitest'
import type { TestCase, TestModule, Vitest } from 'vitest/node'
import { randomUUID } from 'node:crypto'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runInlineTests, runVitest, runVitestCli, useFS } from '#test-utils'

// the inline snapshots have the seeds of the run seed 0
function runSeededTests(...[structure, config, ...rest]: Parameters<typeof runInlineTests>) {
  return runInlineTests(structure, { seed: 0, ...config }, ...rest)
}

const raftTests = /* js */ `
import { expect, test } from 'vitest'

// nodes with the same election timeout both become leaders
function electLeaders(random) {
  const timeouts = [random.int(150, 160), random.int(150, 160), random.int(150, 160)]
  const first = Math.min(...timeouts)
  return timeouts.filter((timeout) => timeout === first).length
}

test('one leader per term', { repeats: 9 }, ({ task, random }) => {
  task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
  expect(electLeaders(random)).toBe(1)
})

test('elects a leader', ({ task, random }) => {
  task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
})
`

function findTest(modules: TestModule[], name: string): TestCase {
  const testCase = modules
    .flatMap((module) => [...module.children.allTests()])
    .find((testCase) => testCase.fullName === name)
  if (!testCase) {
    throw new Error(`The test "${name}" was not found.`)
  }
  return testCase
}

function seedsOf(testCase: TestCase): string[] {
  return testCase.meta().seeds ?? []
}

function formatAttempts(testCase: TestCase): string[] {
  return testCase
    .attempts()
    .map(
      ({ repeatIndex, retryIndex, state, seed }) =>
        `repeat ${repeatIndex} retry ${retryIndex} ${state} ${seed ?? 'no seed'}`,
    )
}

// on Windows, the replay command quotes arguments for PowerShell
function normalizeQuotes(output: string): string {
  if (process.platform !== 'win32') {
    return output
  }
  return output.replace(/^ +Replay {2}.*$/gm, (line) =>
    line.replace(/"((?:[^"`]|`.)*)"/g, (_, value: string) => {
      return `'${value.replace(/`(.)/g, '$1').replace(/'/g, `'\\''`)}'`
    }),
  )
}

function seedLines(stderr: string): string[] {
  return normalizeQuotes(stderr)
    .split('\n')
    .filter((line) => /^ FAIL |^ +(Test|Failed|Seeds?|Reproduced|Replay) {2}/.test(line))
}

// splits a replay command with POSIX quotes into arguments
function parseCommand(command: string): string[] {
  return [...command.matchAll(/'((?:[^']|'\\'')*)'|(\S+)/g)].map(([, quoted, plain]) =>
    quoted != null ? quoted.replaceAll(`'\\''`, `'`) : plain,
  )
}

declare module 'vitest' {
  interface TaskMeta {
    seeds?: string[]
  }
}

test('each repeat gets its own seed, and a failed repeat that used its seed runs again', async () => {
  const { stderr, stdout, results } = await runSeededTests({ 'raft.test.js': raftTests })
  const testCase = findTest(results, 'one leader per term')

  expect(testCase.result().state).toBe('failed')
  expect(testCase.diagnostic()).toMatchObject({ repeatCount: 9, retryCount: 0 })
  // the seeds that the test saw are the seeds of its attempts
  expect(testCase.attempts().map((attempt) => attempt.seed)).toEqual(seedsOf(testCase))
  expect(formatAttempts(testCase)).toMatchInlineSnapshot(`
    [
      "repeat 0 retry 0 passed 6fbadd5eb90fcf71",
      "repeat 1 retry 0 passed 69f64e082843d84e",
      "repeat 2 retry 0 passed ca87dde3c1eef82d",
      "repeat 3 retry 0 passed 7bcc3923abaa5702",
      "repeat 4 retry 0 passed 41f357f8b5c4a5b3",
      "repeat 5 retry 0 passed 4b9e6196bb3a8225",
      "repeat 6 retry 0 failed 5fd3dabb6d1efc9f",
      "repeat 6 retry 1 failed 5fd3dabb6d1efc9f",
      "repeat 7 retry 0 passed 4e8f7aa867201958",
      "repeat 8 retry 0 passed 47cd004b391bdcbd",
      "repeat 9 retry 0 failed 8e64526197754c09",
      "repeat 9 retry 1 failed 8e64526197754c09",
    ]
  `)
  expect(stdout).toMatch(/× raft\.test\.js > one leader per term \d+ms \(repeat x9\)\n/)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  raft.test.js > one leader per term",
      "     Failed  repeats 6, 9",
      "      Seeds  5fd3dabb6d1efc9f, 8e64526197754c09",
      " Reproduced  2 of 2 seeds",
      "     Replay  vitest run raft.test.js -t '^one leader per term$' --seed 0 --replay-seed 5fd3dabb6d1efc9f",
    ]
  `)
})

test('the first repeat has the values of the test without repeats', async () => {
  const withoutRepeats = await runSeededTests({
    'raft.test.js': raftTests.replace(`{ repeats: 9 }, `, ''),
  })
  const withRepeats = await runSeededTests({ 'raft.test.js': raftTests })
  const [first] = seedsOf(findTest(withRepeats.results, 'one leader per term'))
  expect(seedsOf(findTest(withoutRepeats.results, 'one leader per term'))).toEqual([first])
})

test('--replay-seed runs each selected test 1 time with the seed', async () => {
  // the seed of the 6th repeat in the first test of this file
  const replaySeed = '5fd3dabb6d1efc9f'
  const { stderr, results } = await runSeededTests(
    { 'raft.test.js': raftTests },
    { $cliOptions: { replaySeed: replaySeed.toUpperCase() } },
  )
  const repeated = findTest(results, 'one leader per term')
  expect(seedsOf(repeated)).toEqual([replaySeed])
  expect(repeated.diagnostic()?.repeatCount).toBe(0)
  expect(seedsOf(findTest(results, 'elects a leader'))).toEqual([replaySeed])
  expect(normalizeQuotes(stderr)).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  raft.test.js > one leader per term
    AssertionError: expected 2 to be 1 // Object.is equality

    - Expected
    + Received

    - 1
    + 2

     ❯ raft.test.js:13:32
         11| test('one leader per term', { repeats: 9 }, ({ task, random }) => {
         12|   task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
         13|   expect(electLeaders(random)).toBe(1)
           |                                ^
         14| })
         15|

           Seed  5fd3dabb6d1efc9f
         Replay  vitest run raft.test.js -t '^one leader per term$' --seed 0 --replay-seed 5fd3dabb6d1efc9f

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('the replay of a failed repeat does not reproduce the error if state leaks between repeats', async () => {
  const { stderr, results } = await runSeededTests({
    'users.test.js': /* js */ `
      import { expect, test } from 'vitest'

      let nextId = 1

      function createUser(name) {
        return { id: nextId++, name }
      }

      test('the first user gets the id 1', { repeats: 1 }, ({ random }) => {
        const user = createUser(random.pick(['ada', 'grace', 'linus']))
        expect(user.id).toBe(1)
      })
    `,
  })
  expect(formatAttempts(findTest(results, 'the first user gets the id 1'))).toMatchInlineSnapshot(`
    [
      "repeat 0 retry 0 passed b2780e63b3a2361f",
      "repeat 1 retry 0 failed 25dad3a7b67b3282",
      "repeat 1 retry 1 failed 25dad3a7b67b3282",
    ]
  `)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  users.test.js > the first user gets the id 1",
      "     Failed  1st repeat",
      "       Seed  25dad3a7b67b3282",
      " Reproduced  1 of 2 runs: the test depends on more than its seed",
      "     Replay  vitest run users.test.js -t '^the first user gets the id 1$' --seed 0 --replay-seed 25dad3a7b67b3282",
      " FAIL  users.test.js > the first user gets the id 1",
      "     Failed  replay of 1st repeat",
      "       Seed  25dad3a7b67b3282",
      " Reproduced  1 of 2 runs: the test depends on more than its seed",
      "     Replay  vitest run users.test.js -t '^the first user gets the id 1$' --seed 0 --replay-seed 25dad3a7b67b3282",
    ]
  `)
})

test('a failed repeat that does not use its seed does not run again', async () => {
  const { stderr, results } = await runSeededTests({
    'cache.test.js': /* js */ `
      import { expect, test } from 'vitest'

      const cache = new Map()

      test('a new key is not cached', { repeats: 2 }, () => {
        expect(cache.has('user')).toBe(false)
        cache.set('user', { name: 'ada' })
      })
    `,
  })
  expect(formatAttempts(findTest(results, 'a new key is not cached'))).toMatchInlineSnapshot(`
    [
      "repeat 0 retry 0 passed no seed",
      "repeat 1 retry 0 failed no seed",
      "repeat 2 retry 0 failed no seed",
    ]
  `)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  cache.test.js > a new key is not cached (repeats 1-2)",
    ]
  `)
})

test('with retry, a failed repeat runs again with the same seed until the retries end', async () => {
  const { stderr, results } = await runSeededTests({
    'raft.test.js': raftTests.replace(`{ repeats: 9 }`, `{ repeats: 6, retry: 2 }`),
  })
  const testCase = findTest(results, 'one leader per term')
  expect(testCase.result().state).toBe('failed')
  expect(formatAttempts(testCase).filter((attempt) => attempt.includes(' failed ')))
    .toMatchInlineSnapshot(`
    [
      "repeat 6 retry 0 failed 5fd3dabb6d1efc9f",
      "repeat 6 retry 1 failed 5fd3dabb6d1efc9f",
      "repeat 6 retry 2 failed 5fd3dabb6d1efc9f",
    ]
  `)
  expect(seedLines(stderr).filter((line) => line.startsWith(' Seed'))).toMatchInlineSnapshot(`[]`)
})

test('a repeat that passes on a retry counts as passed', async () => {
  const { stderr, results } = await runSeededTests({
    'upload.test.js': /* js */ `
      import { expect, test } from 'vitest'

      // the connection drops 1 time
      let requests = 0
      function upload(size) {
        requests++
        if (requests === 2) {
          throw new Error('connection reset')
        }
        return { size }
      }

      test('uploads a file', { repeats: 3, retry: 1 }, ({ random }) => {
        expect(upload(random.int(1, 100)).size).toBeGreaterThan(0)
      })
    `,
  })
  expect(stderr).toBe('')
  const testCase = findTest(results, 'uploads a file')
  expect(testCase.result().state).toBe('passed')
  expect(testCase.diagnostic()).toMatchObject({ flaky: true, retryCount: 1, repeatCount: 3 })
  expect(formatAttempts(testCase)).toMatchInlineSnapshot(`
    [
      "repeat 0 retry 0 passed 581a08aa231e76a1",
      "repeat 1 retry 0 failed 5b5d2fbb65579d06",
      "repeat 1 retry 1 passed 5b5d2fbb65579d06",
      "repeat 2 retry 0 passed f46e1dccef30a61f",
      "repeat 3 retry 0 passed 721bcb54a9aedeb1",
    ]
  `)
})

test('a repeat that times out does not stop the next repeats', async () => {
  const { stderr, results } = await runSeededTests({
    'upload.test.js': /* js */ `
      import { test } from 'vitest'

      // the first upload hangs
      let uploads = 0
      async function upload() {
        uploads++
        if (uploads === 1) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }

      test('uploads a file', { repeats: 2, retry: 1, timeout: 50 }, async () => {
        await upload()
      })
    `,
  })
  expect(stderr).toBe('')
  const testCase = findTest(results, 'uploads a file')
  expect(testCase.result().state).toBe('passed')
  expect(formatAttempts(testCase)).toMatchInlineSnapshot(`
    [
      "repeat 0 retry 0 failed no seed",
      "repeat 0 retry 1 passed no seed",
      "repeat 1 retry 0 passed no seed",
      "repeat 2 retry 0 passed no seed",
    ]
  `)
})

test('failed repeats at the same place share 1 block, and the replay uses a reproduced seed', async () => {
  const { stderr } = await runSeededTests({
    'queue.test.js': /* js */ `
      import { test } from 'vitest'

      // the queue loses the second message and every message after the fourth
      let deliveries = 0
      function deliver(random) {
        deliveries++
        if (deliveries === 2 || deliveries >= 5) {
          throw new Error('message lost: ' + random.int(1, 9))
        }
      }

      test('delivers every message', { repeats: 3, retry: 1 }, ({ random }) => {
        deliver(random)
      })
    `,
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  queue.test.js > delivers every message",
      "     Failed  repeats 1, 3",
      "      Seeds  1c1b1d6b16769650 (this error), 92f0edf449c15995",
      " Reproduced  1 of 2 seeds, not 92f0edf449c15995: the test depends on more than its seeds",
      "     Replay  vitest run queue.test.js -t '^delivers every message$' --seed 0 --replay-seed 1c1b1d6b16769650",
    ]
  `)
})

test('each repeat runs the hooks and test fixtures again with other values', async () => {
  const { stderr, results } = await runSeededTests({
    'log.test.js': /* js */ `
      import { afterAll, afterEach, beforeAll, beforeEach, test as base } from 'vitest'

      const events = []
      const test = base.extend({
        server: [
          async ({}, use) => {
            events.push('server setup')
            await use()
          },
          { scope: 'file' },
        ],
        log: async ({ random }, use) => {
          events.push('log setup ' + random.int(0, 9))
          await use([])
          events.push('log teardown')
        },
      })

      beforeAll(() => events.push('beforeAll'))
      beforeEach(() => events.push('beforeEach'))
      afterEach(() => events.push('afterEach'))
      afterAll(({}, file) => {
        file.meta.events = events
      })

      test('appends entries', { repeats: 2 }, ({ server, log, random }) => {
        events.push('test ' + random.int(0, 9))
      })
    `,
  })
  expect(stderr).toBe('')
  expect(results[0].meta()).toMatchInlineSnapshot(`
    {
      "__vitest_label__": undefined,
      "events": [
        "beforeAll",
        "beforeEach",
        "server setup",
        "log setup 1",
        "test 2",
        "afterEach",
        "log teardown",
        "beforeEach",
        "log setup 1",
        "test 7",
        "afterEach",
        "log teardown",
        "beforeEach",
        "log setup 7",
        "test 2",
        "afterEach",
        "log teardown",
      ],
    }
  `)
})

test('seeds in include run first, and --repeats sets the count of tests without repeats', async () => {
  const files = {
    'log.test.js': /* js */ `
      import { test } from 'vitest'

      test('regressions', { repeats: { count: 1, include: ['0123456789ABCDEF'] } }, ({ task, random }) => {
        task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
      })

      test('own count', { repeats: 4 }, ({ task, random }) => {
        task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
      })

      test('no repeats', ({ task, random }) => {
        task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
      })

      test('simulation', { tags: ['simulation'] }, ({ task, random }) => {
        task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
      })
    `,
  }
  const config = {
    tags: [{ name: 'simulation', repeats: { count: 1, include: ['fedcba9876543210'] } }],
  }
  const runs = (modules: TestModule[]) =>
    Object.fromEntries(
      ['regressions', 'own count', 'no repeats', 'simulation'].map((name) => {
        const seeds = seedsOf(findTest(modules, name))
        return [name, `${seeds.length} runs, first ${seeds[0]}`]
      }),
    )

  const { stderr, results } = await runSeededTests(files, config)
  expect(stderr).toBe('')
  expect(runs(results)).toMatchInlineSnapshot(`
    {
      "no repeats": "1 runs, first e72d646308ee25df",
      "own count": "5 runs, first 4174c447c0adabe0",
      "regressions": "3 runs, first 0123456789abcdef",
      "simulation": "3 runs, first fedcba9876543210",
    }
  `)

  const changed = await runSeededTests(files, { ...config, $cliOptions: { repeats: 2 } })
  expect(changed.stderr).toBe('')
  expect(runs(changed.results)).toMatchInlineSnapshot(`
    {
      "no repeats": "3 runs, first e72d646308ee25df",
      "own count": "5 runs, first 4174c447c0adabe0",
      "regressions": "3 runs, first 0123456789abcdef",
      "simulation": "3 runs, first fedcba9876543210",
    }
  `)
})

test('the repeats option rejects invalid values', async () => {
  const { stderr } = await runSeededTests({
    'type.test.js': `import { test } from 'vitest'; test('a', { repeats: 'many' }, () => {})`,
    'count.test.js': `import { test } from 'vitest'; test('a', { repeats: { count: -1 } }, () => {})`,
    'include.test.js': `import { test } from 'vitest'; test('a', { repeats: { include: ['42'] } }, () => {})`,
  })
  // files can run in any order
  expect(
    stderr
      .split('\n')
      .filter((line) => line.startsWith('TypeError'))
      .sort(),
  ).toMatchInlineSnapshot(`
    [
      "TypeError: "repeats.count" must be a non-negative integer, received -1.",
      "TypeError: A seed in "repeats.include" must be a string of 16 hexadecimal digits, received "42".",
      "TypeError: The "repeats" option must be a number or an object, received "many".",
    ]
  `)
})

test('--replay-seed rejects invalid values', async () => {
  const { stderr } = await runSeededTests(
    { 'raft.test.js': raftTests },
    { $cliOptions: { replaySeed: '42' } },
  )
  expect(stderr.split('\n').find((line) => line.startsWith('TypeError'))).toMatchInlineSnapshot(
    `"TypeError: The "--replay-seed" flag must have 16 hexadecimal digits, received "42"."`,
  )
})

test('the replay commands of a merged report use the flags and the seed of each blob', async () => {
  const root = resolve(process.cwd(), `vitest-test-${randomUUID()}`)
  useFS(root, {
    'raft.test.js': raftTests,
    'election.test.js': raftTests,
  })
  for (const [index, seed] of [
    [1, 3],
    [2, 4],
  ]) {
    await runVitestCli(
      'run',
      '--root',
      root,
      '--shard',
      `${index}/2`,
      '--seed',
      String(seed),
      '--test-timeout',
      String(5000 + index),
      '--reporter=blob',
      `--outputFile=${root}/.vitest/blob/${index}.json`,
    )
  }
  const { stderr } = await runVitest({ root, mergeReports: resolve(root, '.vitest/blob') })
  expect(
    normalizeQuotes(stderr)
      .split('\n')
      .filter((line) => /^ +Replay {2}/.test(line))
      .map((line) => line.replaceAll(root, '<root>')),
  ).toMatchInlineSnapshot(`
    [
      "     Replay  vitest run raft.test.js -t '^one leader per term$' --root <root> --test-timeout 5001 --maxWorkers=1 --seed 3 --replay-seed 20812fe987dfbf02",
      "     Replay  vitest run election.test.js -t '^one leader per term$' --root <root> --test-timeout 5002 --maxWorkers=1 --seed 4 --replay-seed c57513e8e7ae3532",
    ]
  `)
})

test('the replay command quotes a run seed with spaces', async () => {
  const { stderr } = await runInlineTests(
    {
      'dice.test.js': /* js */ `
        import { expect, test } from 'vitest'

        test('rolls a seven', ({ random }) => {
          expect(random.int(1, 6)).toBe(7)
        })
      `,
    },
    { seed: 'nightly run' },
  )
  const replayLine = normalizeQuotes(stderr)
    .split('\n')
    .find((line) => /^ +Replay {2}/.test(line))
  expect(replayLine?.replace(/[\da-f]{16}$/, '<seed>')).toMatchInlineSnapshot(
    `"     Replay  vitest run dice.test.js -t '^rolls a seven$' --seed 'nightly run' --replay-seed <seed>"`,
  )
})

test('the replay command keeps the flags of the vitest command', async () => {
  const root = resolve(process.cwd(), `vitest-test-${randomUUID()}`)
  useFS(root, {
    'raft.test.js': raftTests,
    'vitest.e2e.config.js': 'export default {}',
  })
  const { stderr } = await runVitestCli(
    'run',
    'raft',
    '-t',
    'one leader',
    '--root',
    root,
    `--config=${root}/vitest.e2e.config.js`,
    '--repeats',
    '2',
    '--seed',
    '0',
    '--test-timeout',
    '5000',
    '--no-file-parallelism',
    // the replay command does not write reports or update snapshots
    '--reporter=default',
    '--reporter=json',
    `--outputFile.json=${root}/report.json`,
    '-u',
  )
  const replayLine = normalizeQuotes(stderr)
    .split('\n')
    .find((line) => /^ +Replay {2}/.test(line))
  expect(replayLine?.replaceAll(root, '<root>')).toMatchInlineSnapshot(
    `"     Replay  vitest run raft.test.js -t '^one leader per term$' --root <root> --config=<root>/vitest.e2e.config.js --test-timeout 5000 --no-file-parallelism --maxWorkers=1 --seed 0 --replay-seed 5fd3dabb6d1efc9f"`,
  )

  // the printed command fails with the same error, and `runVitestCli` adds `--maxWorkers=1` itself
  const [, ...args] = parseCommand(replayLine!.replace(/^ +Replay {2}/, ''))
  const replay = await runVitestCli(...args.filter((arg) => arg !== '--maxWorkers=1'))
  const errorLines = (output: string) =>
    output.split('\n').filter((line) => /^( FAIL|AssertionError)|^ +Seed {2}/.test(line))
  expect(errorLines(replay.stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  raft.test.js > one leader per term",
      "AssertionError: expected 2 to be 1 // Object.is equality",
      "       Seed  5fd3dabb6d1efc9f",
    ]
  `)
  const errorMessage = (output: string) =>
    output.split('\n').find((line) => line.startsWith('AssertionError'))
  expect(errorMessage(replay.stderr)).toBe(errorMessage(stderr))
  expect(
    replay.stdout.split('\n').find((line) => line.includes('Replaying')),
  ).toMatchInlineSnapshot(`"      Replaying seed "5fd3dabb6d1efc9f""`)
})

test('a skip in the replay keeps the failure of the repeat', async () => {
  const { stderr, results } = await runSeededTests({
    'payments.test.js': /* js */ `
      import { expect, test } from 'vitest'

      // the sandbox of the payment provider allows 1 request
      let quota = 1
      function charge(random) {
        quota--
        return { amount: random.int(1, 99), currency: 'usd' }
      }

      test('charges the card in dollars', { repeats: 1 }, ({ random, skip }) => {
        skip(quota === 0, 'no quota left in the sandbox')
        expect(charge(random).currency).toBe('USD')
      })
    `,
  })
  const testCase = findTest(results, 'charges the card in dollars')
  expect(testCase.result().state).toBe('failed')
  expect(formatAttempts(testCase)).toMatchInlineSnapshot(`
    [
      "repeat 0 retry 0 failed e5b823090544e789",
      "repeat 0 retry 1 skipped e5b823090544e789",
      "repeat 1 retry 0 skipped cb74f1b438efab48",
    ]
  `)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  payments.test.js > charges the card in dollars",
      "     Failed  initial run",
      "       Seed  e5b823090544e789",
      " Reproduced  1 of 2 runs: the test depends on more than its seed",
      "     Replay  vitest run payments.test.js -t '^charges the card in dollars$' --seed 0 --replay-seed e5b823090544e789",
    ]
  `)
})

test('a skip ends only its repeat', async () => {
  const { stderr, results } = await runSeededTests({
    'checkout.test.js': /* js */ `
      import { expect, test } from 'vitest'

      // the new checkout is missing in the us region
      function checkoutVersion(region) {
        return region === 'us' ? 'old' : 'new'
      }

      test('shows the checkout', { repeats: 5 }, ({ random, skip }) => {
        const region = random.pick(['eu', 'us', 'ap'])
        skip(region === 'ap', 'no feature flags in ap')
        expect(checkoutVersion(region)).toBe('new')
      })

      test('shows the checkout in eu', { repeats: 5 }, ({ random, skip }) => {
        const region = random.pick(['eu', 'ap'])
        skip(region === 'ap', 'no feature flags in ap')
        expect(checkoutVersion(region)).toBe('new')
      })

      test('shows the checkout in ap', { repeats: 2 }, ({ skip }) => {
        skip('no feature flags in ap')
      })
    `,
  })
  const states = Object.fromEntries(
    ['shows the checkout', 'shows the checkout in eu', 'shows the checkout in ap'].map((name) => {
      const testCase = findTest(results, name)
      return [name, [testCase.result().state, ...formatAttempts(testCase)]]
    }),
  )
  expect(states).toMatchInlineSnapshot(`
    {
      "shows the checkout": [
        "failed",
        "repeat 0 retry 0 failed b2fd4ff2f56f3979",
        "repeat 0 retry 1 failed b2fd4ff2f56f3979",
        "repeat 1 retry 0 failed bec8356c714d722d",
        "repeat 1 retry 1 failed bec8356c714d722d",
        "repeat 2 retry 0 skipped feb908187a8c2f78",
        "repeat 3 retry 0 skipped 740a81b3ea14e0b0",
        "repeat 4 retry 0 failed 50721d49a42bcf1f",
        "repeat 4 retry 1 failed 50721d49a42bcf1f",
        "repeat 5 retry 0 passed 0e60c093c99ed3db",
      ],
      "shows the checkout in ap": [
        "skipped",
        "repeat 0 retry 0 skipped no seed",
        "repeat 1 retry 0 skipped no seed",
        "repeat 2 retry 0 skipped no seed",
      ],
      "shows the checkout in eu": [
        "passed",
        "repeat 0 retry 0 passed 12a23653fb887f72",
        "repeat 1 retry 0 skipped 52b5a05fa19e73bd",
        "repeat 2 retry 0 skipped 04f1a6089412cbc3",
        "repeat 3 retry 0 skipped 3221790fba4191ba",
        "repeat 4 retry 0 passed ed95520bd4548e22",
        "repeat 5 retry 0 passed 0784f32408106e93",
      ],
    }
  `)
  expect(findTest(results, 'shows the checkout in ap').result()).toMatchInlineSnapshot(`
    {
      "errors": undefined,
      "note": "no feature flags in ap",
      "state": "skipped",
    }
  `)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  checkout.test.js > shows the checkout",
      "     Failed  initial run, repeats 1, 4",
      "      Seeds  b2fd4ff2f56f3979, bec8356c714d722d, 50721d49a42bcf1f",
      " Reproduced  3 of 3 seeds",
      "     Replay  vitest run checkout.test.js -t '^shows the checkout$' --seed 0 --replay-seed b2fd4ff2f56f3979",
    ]
  `)
})

class CancelOnReadyReporter {
  vitest!: Vitest
  onInit(vitest: Vitest) {
    this.vitest = vitest
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (log.content.includes('ready')) {
      this.vitest.cancelCurrentRun('keyboard-input')
    }
  }
}

test('a cancel during the repeats keeps the failures of earlier repeats', async () => {
  const { results } = await runSeededTests(
    {
      'replicas.test.js': /* js */ `
        import { expect, test } from 'vitest'

        let runs = 0
        function waitForSync(signal) {
          return new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason))
          })
        }

        test('syncs the replicas', { repeats: 3 }, async ({ random, signal }) => {
          runs++
          const replicas = random.int(2, 5)
          // the first repeat and its replay fail, the next repeat waits until the run is cancelled
          if (runs <= 2) {
            expect(replicas).toBe(0)
          }
          console.log('ready')
          await waitForSync(signal)
        })
      `,
    },
    { reporters: ['default', new CancelOnReadyReporter()] },
  )
  const testCase = findTest(results, 'syncs the replicas')
  expect(testCase.result().state).toBe('failed')
  expect(formatAttempts(testCase)).toMatchInlineSnapshot(`
    [
      "repeat 0 retry 0 failed 84d08226004505c9",
      "repeat 0 retry 1 failed 84d08226004505c9",
      "repeat 1 retry 0 skipped 11cdf66632d91dd4",
    ]
  `)
})

test('test.fails with repeats fails for the seeds that pass', async () => {
  const { stderr, results } = await runSeededTests({
    'tokens.test.js': /* js */ `
      import { expect, test } from 'vitest'

      function isValid(token) {
        return token.age < 60
      }

      // the tokens of a bug report are always expired
      test.fails('accepts the tokens of the bug report', { repeats: 3 }, ({ random }) => {
        expect(isValid({ age: random.int(0, 120) })).toBe(true)
      })
    `,
  })
  expect(formatAttempts(findTest(results, 'accepts the tokens of the bug report')))
    .toMatchInlineSnapshot(`
      [
        "repeat 0 retry 0 failed 72b1ec8ad9e8258e",
        "repeat 0 retry 1 failed 72b1ec8ad9e8258e",
        "repeat 1 retry 0 failed 6cb039936e32b688",
        "repeat 1 retry 1 failed 6cb039936e32b688",
        "repeat 2 retry 0 passed 1dd5c9b595e6e959",
        "repeat 3 retry 0 failed 106d5d304c218a00",
        "repeat 3 retry 1 failed 106d5d304c218a00",
      ]
    `)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  tokens.test.js > accepts the tokens of the bug report",
      "     Failed  initial run, repeats 1, 3",
      "      Seeds  72b1ec8ad9e8258e, 6cb039936e32b688, 106d5d304c218a00",
      " Reproduced  3 of 3 seeds",
      "     Replay  vitest run tokens.test.js -t '^accepts the tokens of the bug report$' --seed 0 --replay-seed 72b1ec8ad9e8258e",
    ]
  `)
})

test('Math.random gets other values in each repeat with vi.useFakeRandom or fakeRandom', async () => {
  const files = {
    'ids.test.js': /* js */ `
      import { expect, test, vi } from 'vitest'

      function createId() {
        return Math.random().toString(36).slice(2, 4)
      }

      test('creates an id with a letter', { repeats: 3 }, ({ task }) => {
        VI_USE_FAKE_RANDOM
        const id = createId()
        task.meta.seeds = [...(task.meta.seeds ?? []), id]
        expect(id).toMatch(/[a-z]/)
      })
    `,
  }
  const withVi = await runSeededTests({
    'ids.test.js': files['ids.test.js'].replace('VI_USE_FAKE_RANDOM', 'vi.useFakeRandom()'),
  })
  const withConfig = await runSeededTests(
    { 'ids.test.js': files['ids.test.js'].replace('VI_USE_FAKE_RANDOM', '') },
    { fakeRandom: { enableGlobally: true } },
  )
  const testCase = findTest(withVi.results, 'creates an id with a letter')
  // the ids are the same with both options, and each repeat has another id
  expect(seedsOf(findTest(withConfig.results, 'creates an id with a letter'))).toEqual(
    seedsOf(testCase),
  )
  expect(seedsOf(testCase)).toMatchInlineSnapshot(`
    [
      "mq",
      "te",
      "zj",
      "dq",
    ]
  `)
  expect(formatAttempts(testCase)).toMatchInlineSnapshot(`
    [
      "repeat 0 retry 0 passed ccfc4d2ec821a2db",
      "repeat 1 retry 0 passed b9be2b11ab54d771",
      "repeat 2 retry 0 passed 4e76a48244d5303e",
      "repeat 3 retry 0 passed c667d69a605924e1",
    ]
  `)
  expect(seedLines(withVi.stderr)).toMatchInlineSnapshot(`[]`)
})

test('seeds that fail with the same error share 1 block', async () => {
  const { stderr } = await runSeededTests({
    'sort.test.js': /* js */ `
      import { expect, test } from 'vitest'

      function sortNumbers(numbers) {
        if (new Set(numbers).size < numbers.length) {
          throw new Error('duplicate numbers are not supported')
        }
        return [...numbers].sort((a, b) => a - b)
      }

      // with 4 numbers from 1 to 6, most seeds have duplicates
      test('sorts numbers', { repeats: 29 }, ({ random }) => {
        const numbers = Array.from({ length: 4 }, () => random.int(1, 6))
        expect(sortNumbers(numbers)).toHaveLength(4)
      })
    `,
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  sort.test.js > sorts numbers",
      "     Failed  repeats 2-11, 13, 15-16, 20, 23-25 and 3 more",
      "      Seeds  f316888a769950b0, e423305c3686756a, fba90f3a58ed3d0a and 17 more",
      " Reproduced  20 of 20 seeds",
      "     Replay  vitest run sort.test.js -t '^sorts numbers$' --seed 0 --replay-seed f316888a769950b0",
    ]
  `)
  expect(stderr.split('\n').length).toMatchInlineSnapshot(`22`)
})

test('seeds that fail at the same place with other values share 1 block', async () => {
  const { stderr } = await runSeededTests({
    'sort.test.js': /* js */ `
      import { expect, test } from 'vitest'

      // drops duplicate numbers by mistake
      function sortNumbers(numbers) {
        return [...new Set(numbers)].sort((a, b) => a - b)
      }

      test('keeps every number', { repeats: 29 }, ({ random }) => {
        const numbers = Array.from({ length: 4 }, () => random.int(1, 6))
        expect(sortNumbers(numbers)).toHaveLength(4)
      })
    `,
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  sort.test.js > keeps every number",
      "     Failed  repeats 1-2, 4, 6-7, 9, 11-17 and 8 more",
      "      Seeds  d83d6cbe8b1c6d5e (this error), 705d78aede9da214, 8ca51136dedded3a and 18 more",
      " Reproduced  21 of 21 seeds",
      "     Replay  vitest run sort.test.js -t '^keeps every number$' --seed 0 --replay-seed d83d6cbe8b1c6d5e",
    ]
  `)
  expect(stderr.split('\n').length).toMatchInlineSnapshot(`28`)
})

test('the replay command selects the project, the seed of the run, and escapes the test name', async () => {
  const { stderr } = await runSeededTests(
    {
      'queue.test.js': /* js */ `
        import { describe, expect, test } from 'vitest'

        describe('queue (v2)', () => {
          test("it's [fast] for $1", { repeats: 1 }, ({ random }) => {
            expect(random.int(0, 9)).toBeLessThan(0)
          })
        })
      `,
    },
    {
      seed: 5,
      projects: [{ extends: true, test: { name: 'unit' } }],
    },
  )
  const replay = stderr.split('\n').find((line) => /^ +Replay {2}/.test(line))
  if (process.platform === 'win32') {
    expect(replay).toBe(
      '     Replay  vitest run queue.test.js -t "^queue \\(v2\\) > it\'s \\[fast\\] for \\`$1`$" --project unit --seed 5 --replay-seed 24fddfe49875cc1d',
    )
  }
  expect(normalizeQuotes(replay ?? '')).toMatchInlineSnapshot(
    `"     Replay  vitest run queue.test.js -t '^queue \\(v2\\) > it'\\''s \\[fast\\] for \\$1$' --project unit --seed 5 --replay-seed 24fddfe49875cc1d"`,
  )
})

test('the repeats of a suite apply to each test in it', async () => {
  const { stderr, results } = await runSeededTests({
    'log.test.js': /* js */ `
      import { describe, test } from 'vitest'

      describe('log', { repeats: { count: 1, include: ['0123456789abcdef'] } }, () => {
        test('appends', ({ task, random }) => {
          task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
        })

        test('compacts', ({ task, random }) => {
          task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
        })
      })
    `,
  })
  expect(stderr).toBe('')
  expect({
    appends: seedsOf(findTest(results, 'log > appends')),
    compacts: seedsOf(findTest(results, 'log > compacts')),
  }).toMatchInlineSnapshot(`
    {
      "appends": [
        "0123456789abcdef",
        "7357c169bb6a1b45",
        "12dbf6bd22836d5b",
      ],
      "compacts": [
        "0123456789abcdef",
        "4b557e536aa8b431",
        "f07264eea1432f39",
      ],
    }
  `)
})

test('a seed in include that is the seed of the test runs 1 time', async () => {
  const files = (repeats: string) => ({
    'raft.test.js': raftTests.replace(`{ repeats: 9 }`, repeats),
  })
  const withoutRepeats = await runSeededTests(files(`{}`))
  const [seed] = seedsOf(findTest(withoutRepeats.results, 'one leader per term'))
  const { results } = await runSeededTests(
    files(`{ repeats: { count: 1, include: ['0123456789abcdef', '${seed}'] } }`),
  )
  const seeds = seedsOf(findTest(results, 'one leader per term'))
  expect(seeds).toHaveLength(4)
  expect(new Set(seeds).size).toBe(4)
  expect(seeds.slice(0, 2)).toEqual(['0123456789abcdef', seed])
})

test('nullish values in the repeats option are the defaults', async () => {
  const { stderr, results } = await runSeededTests({
    'log.test.js': /* js */ `
      import { test } from 'vitest'

      test('appends', { repeats: { count: 2, include: null } }, ({ task, random }) => {
        task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
      })

      test('compacts', { repeats: { count: undefined, include: ['0123456789abcdef'] } }, ({ task, random }) => {
        task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
      })
    `,
  })
  expect(stderr).toBe('')
  expect(seedsOf(findTest(results, 'appends'))).toHaveLength(3)
  expect(seedsOf(findTest(results, 'compacts'))).toHaveLength(2)
})

test('--replay-seed prints the seed in the header and warns about --repeats', async () => {
  const { stderr, stdout, results } = await runSeededTests(
    { 'raft.test.js': raftTests },
    { reporters: 'default', $cliOptions: { replaySeed: '5fd3dabb6d1efc9f', repeats: 3 } },
  )
  expect(seedsOf(findTest(results, 'one leader per term'))).toEqual(['5fd3dabb6d1efc9f'])
  expect(stderr.split('\n')[0]).toMatchInlineSnapshot(
    `" Vitest  "--repeats" has no effect with "--replay-seed". Each selected test runs 1 time with the replay seed."`,
  )
  expect(stdout.split('\n').find((line) => line.includes('Replaying'))).toMatchInlineSnapshot(
    `"      Replaying seed "5fd3dabb6d1efc9f""`,
  )
})

test('a failed test shows only the annotations of the runs with the shown error', async () => {
  const { stderr, results } = await runSeededTests({
    'seats.test.js': /* js */ `
      import { expect, test } from 'vitest'

      // a group that needs all free seats is rejected by mistake
      function canReserve(freeSeats, group) {
        return group < freeSeats
      }

      test('reserves seats for a group', { repeats: 5 }, async ({ random, annotate }) => {
        const freeSeats = random.int(1, 3)
        const group = random.int(1, 3)
        await annotate(freeSeats + ' free seats, a group of ' + group)
        expect(canReserve(freeSeats, group)).toBe(group <= freeSeats)
      })
    `,
  })
  const testCase = findTest(results, 'reserves seats for a group')
  // each annotation has its attempt
  expect(
    testCase
      .annotations()
      .map(
        ({ message, repeatIndex, retryIndex }) =>
          `repeat ${repeatIndex} retry ${retryIndex}: ${message}`,
      ),
  ).toMatchInlineSnapshot(`
    [
      "repeat 0 retry 0: 2 free seats, a group of 2",
      "repeat 0 retry 1: 2 free seats, a group of 2",
      "repeat 1 retry 0: 3 free seats, a group of 2",
      "repeat 2 retry 0: 2 free seats, a group of 1",
      "repeat 3 retry 0: 3 free seats, a group of 1",
      "repeat 4 retry 0: 3 free seats, a group of 3",
      "repeat 4 retry 1: 3 free seats, a group of 3",
      "repeat 5 retry 0: 3 free seats, a group of 3",
      "repeat 5 retry 1: 3 free seats, a group of 3",
    ]
  `)
  expect(stderr.split('\n').filter((line) => /^ +(↳ |(Failed|Seeds?) {2})/.test(line)))
    .toMatchInlineSnapshot(`
    [
      "   ↳ 2 free seats, a group of 2",
      "     Failed  initial run, repeats 4-5",
      "      Seeds  272901c1e2919c57, ff39474161253c86, 9ea8965d6127b3c1",
    ]
  `)
})
