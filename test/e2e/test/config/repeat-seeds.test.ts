import type { UserConsoleLog } from 'vitest'
import type { FailedSeed, TestCase, TestModule, Vitest } from 'vitest/node'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'pathe'
import { expect, onTestFinished, test } from 'vitest'
import { GithubActionsReporter } from 'vitest/node'
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
function normalizeCommand(command: string): string {
  if (process.platform !== 'win32') {
    return command
  }
  return command.replace(/"((?:[^"`]|`.)*)"/g, (_, value: string) => {
    return `'${value.replace(/`(.)/g, '$1').replace(/'/g, `'\\''`)}'`
  })
}

function normalizeQuotes(output: string): string {
  return output.replace(/^ +Replay {2}.*$/gm, normalizeCommand)
}

function seedLines(stderr: string): string[] {
  return normalizeQuotes(stderr)
    .split('\n')
    .filter((line) => /^ FAIL |^ +(Test|Failed|Reproduced|Replay) {2}|^ {13}\S/.test(line))
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
  // the search for a smaller input runs the test again, see shrink.test.ts
  const { stderr, stdout, results } = await runSeededTests(
    { 'raft.test.js': raftTests },
    { shrink: false },
  )
  const testCase = findTest(results, 'one leader per term')

  expect(testCase.result().state).toBe('failed')
  expect(testCase.diagnostic()).toMatchObject({ repeatCount: 9, retryCount: 0 })
  // the seeds that the test saw are the seeds of its attempts
  expect(testCase.attempts().map((attempt) => attempt.seed)).toEqual(seedsOf(testCase))
  expect(formatAttempts(testCase)).toMatchInlineSnapshot(`
    [
      "repeat 0 retry 0 passed cc4086866312a2e5",
      "repeat 1 retry 0 passed 8b3578378a3fe72c",
      "repeat 2 retry 0 passed 4608dea8b4b3a32c",
      "repeat 3 retry 0 passed c9f48a8850c0cffe",
      "repeat 4 retry 0 failed d1d84a3ad3f37dda",
      "repeat 4 retry 1 failed d1d84a3ad3f37dda",
      "repeat 5 retry 0 passed fd6623d04c33c6b7",
      "repeat 6 retry 0 passed 0fe17ed40e967ddc",
      "repeat 7 retry 0 failed 22c9d547f799e25b",
      "repeat 7 retry 1 failed 22c9d547f799e25b",
      "repeat 8 retry 0 passed 02108a9108a873ab",
      "repeat 9 retry 0 passed 33ba083dc7d6925f",
    ]
  `)
  expect(stdout).toMatch(/× raft\.test\.js > one leader per term \d+ms \(repeat x9\)\n/)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  raft.test.js > one leader per term",
      "     Failed  2 of 10 runs",
      "     Replay  vitest run raft.test.js -t '^one leader per term$' --seed 0 --replay-seed d1d84a3ad3f37dda",
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
    { shrink: false, $cliOptions: { replaySeed: replaySeed.toUpperCase() } },
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
      "repeat 0 retry 0 passed 2ea76287d107bf74",
      "repeat 1 retry 0 failed ad8f82647547677d",
      "repeat 1 retry 1 failed ad8f82647547677d",
    ]
  `)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  users.test.js > the first user gets the id 1",
      "     Failed  1 of 2 runs",
      " Reproduced  no, the 2nd run failed with another error, so the test depends on more than its seed",
      "             AssertionError: expected 3 to be 1 // Object.is equality",
      "     Replay  vitest run users.test.js -t '^the first user gets the id 1$' --seed 0 --replay-seed ad8f82647547677d",
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
        "repeat 4 retry 0 failed d1d84a3ad3f37dda",
        "repeat 4 retry 1 failed d1d84a3ad3f37dda",
        "repeat 4 retry 2 failed d1d84a3ad3f37dda",
      ]
    `)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  raft.test.js > one leader per term",
      "     Failed  1 of 7 runs",
      "             random.int(150, 160) → 150 (raft.test.js:6:50)",
      "             random.int(150, 160) → 150 (raft.test.js:6:72)",
      "     Replay  vitest run raft.test.js -t '^one leader per term$' --seed 0 --replay-seed d1d84a3ad3f37dda:AQEAAwA",
    ]
  `)
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
      "repeat 0 retry 0 passed b865138716d29597",
      "repeat 1 retry 0 failed 8d8a07802c671bfd",
      "repeat 1 retry 1 passed 8d8a07802c671bfd",
      "repeat 2 retry 0 passed 1dbd8b989bc55291",
      "repeat 3 retry 0 passed e0cd54d0f1ddfa06",
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
      "     Failed  2 of 4 runs",
      " Reproduced  no for 1 of 2 seeds (d9c58389e94d45aa), so the test depends on more than its seeds",
      "     Replay  vitest run queue.test.js -t '^delivers every message$' --seed 0 --replay-seed 3d48286ce9b84413:AQEAAQA",
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
        "log setup 5",
        "test 9",
        "afterEach",
        "log teardown",
        "beforeEach",
        "log setup 6",
        "test 3",
        "afterEach",
        "log teardown",
        "beforeEach",
        "log setup 6",
        "test 0",
        "afterEach",
        "log teardown",
      ],
    }
  `)
})

test('kept seeds run first, and --repeats sets the count of tests without repeats', async () => {
  const files = {
    'log.test.js': /* js */ `
      import { test } from 'vitest'

      test('regressions', { repeats: 1, seeds: ['0123456789ABCDEF'] }, ({ task, random }) => {
        task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
      })

      test('kept seed', { seeds: ['00000000000000ff'] }, ({ task, random }) => {
        task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
      })

      test('own count', { repeats: 4 }, ({ task, random }) => {
        task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
      })

      test('no repeats', ({ task, random }) => {
        task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
      })

      test('simulation', { tags: ['simulation'], seeds: ['fedcba9876543210'] }, ({ task, random }) => {
        task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
      })
    `,
  }
  const config = {
    tags: [{ name: 'simulation', repeats: 3 }],
  }
  const runs = (modules: TestModule[]) =>
    Object.fromEntries(
      ['regressions', 'kept seed', 'own count', 'no repeats', 'simulation'].map((name) => {
        const seeds = seedsOf(findTest(modules, name))
        return [name, `${seeds.length} runs, first ${seeds[0]}`]
      }),
    )

  const { stderr, results } = await runSeededTests(files, config)
  expect(stderr).toBe('')
  expect(runs(results)).toMatchInlineSnapshot(`
    {
      "kept seed": "2 runs, first 00000000000000ff",
      "no repeats": "1 runs, first bbd3fd057bbfc16a",
      "own count": "5 runs, first 291c173765c1eb80",
      "regressions": "3 runs, first 0123456789abcdef",
      "simulation": "5 runs, first fedcba9876543210",
    }
  `)

  const changed = await runSeededTests(files, { ...config, $cliOptions: { repeats: 2 } })
  expect(changed.stderr).toBe('')
  expect(runs(changed.results)).toMatchInlineSnapshot(`
    {
      "kept seed": "4 runs, first 00000000000000ff",
      "no repeats": "3 runs, first bbd3fd057bbfc16a",
      "own count": "5 runs, first 291c173765c1eb80",
      "regressions": "3 runs, first 0123456789abcdef",
      "simulation": "5 runs, first fedcba9876543210",
    }
  `)
})

test('the details of a failure name the kept seeds that failed', async () => {
  // the 6th repeat of the first test of this file fails with this seed
  const { stderr } = await runSeededTests({
    'raft.test.js': raftTests.replace(
      `{ repeats: 9 }`,
      `{ repeats: 2, seeds: ['5fd3dabb6d1efc9f'] }`,
    ),
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  raft.test.js > one leader per term",
      "     Failed  1 of 4 runs: kept seed 5fd3dabb6d1efc9f",
      "             random.int(150, 160) → 150 (raft.test.js:6:50)",
      "             random.int(150, 160) → 150 (raft.test.js:6:72)",
      "     Replay  vitest run raft.test.js -t '^one leader per term$' --seed 0 --replay-seed 5fd3dabb6d1efc9f:AQEAAwA",
    ]
  `)
})

test('the repeats and seeds options reject invalid values', async () => {
  const { stderr } = await runSeededTests({
    'type.test.js': `import { test } from 'vitest'; test('a', { repeats: 'many' }, () => {})`,
    'object.test.js': `import { test } from 'vitest'; test('a', { repeats: { count: 1 } }, () => {})`,
    'seeds.test.js': `import { test } from 'vitest'; test('a', { seeds: '0123456789abcdef' }, () => {})`,
    'seed.test.js': `import { test } from 'vitest'; test('a', { seeds: ['42'] }, () => {})`,
    'twice.test.js': `import { test } from 'vitest'; test('a', { seeds: ['0123456789abcdef', '0123456789ABCDEF'] }, () => {})`,
  })
  // files can run in any order
  expect(
    stderr
      .split('\n')
      .filter((line) => line.startsWith('TypeError'))
      .sort(),
  ).toMatchInlineSnapshot(`
    [
      "TypeError: "seeds" has the seed "0123456789ABCDEF" more than 1 time.",
      "TypeError: A seed in "seeds" must be a string of 16 hexadecimal digits, received "42".",
      "TypeError: The "repeats" option must be a number, received "many".",
      "TypeError: The "repeats" option must be a number, received {"count":1}.",
      "TypeError: The "seeds" option must be an array of seeds, received "0123456789abcdef".",
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

test('the JSON and JUnit reports have the run seed and the failed seeds', async () => {
  const { root } = await runInlineTests(
    { 'raft.test.js': raftTests },
    { reporters: ['json', 'junit'], seed: 9 },
  )
  const json = JSON.parse(readFileSync(resolve(root, '.vitest/json/output.json'), 'utf-8'))
  expect(json.seed).toBe('9')
  expect(
    json.testResults[0].assertionResults.map(
      ({ title, failedSeeds }: { title: string; failedSeeds?: FailedSeed[] }) => ({
        title,
        failedSeeds: failedSeeds?.map((seed) => ({
          ...seed,
          command: normalizeCommand(seed.command),
          // the time of the search changes on every run
          ...(seed.shrink && { shrink: { ...seed.shrink, duration: '<time>' } }),
        })),
      }),
    ),
  ).toMatchInlineSnapshot(`
    [
      {
        "failedSeeds": [
          {
            "command": "vitest run raft.test.js -t '^one leader per term$' --seed 9 --replay-seed 3883915706fd6a1e:AQEAAwA",
            "reproduced": 2,
            "runs": 2,
            "seed": "3883915706fd6a1e",
            "shrink": {
              "duration": "<time>",
              "runs": 2,
              "values": [
                3,
                0,
              ],
            },
            "tape": "AQEAAwA",
          },
          {
            "command": "vitest run raft.test.js -t '^one leader per term$' --seed 9 --replay-seed f116698a285d558c",
            "reproduced": 2,
            "runs": 2,
            "seed": "f116698a285d558c",
          },
        ],
        "title": "one leader per term",
      },
      {
        "failedSeeds": undefined,
        "title": "elects a leader",
      },
    ]
  `)

  const junit = readFileSync(resolve(root, '.vitest/junit/output.xml'), 'utf-8')
  expect(junit.split('\n').filter((line) => line.includes('<property'))).toMatchInlineSnapshot(`
    [
      "            <property name="vitest.runSeed" value="9">",
      "                <property name="vitest.seed" value="3883915706fd6a1e">",
      "                <property name="vitest.seed" value="f116698a285d558c">",
    ]
  `)
  // the first failure of the test ends with the seed details
  const failure = junit
    .match(/<failure[^>]*>(.*?)<\/failure>/s)?.[1]
    .replace(/&apos;/g, `'`)
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
  expect(
    normalizeQuotes(failure ?? '')
      .split('\n')
      .filter((line) => /^ +(Failed|Seeds?|Reproduced|Replay) {2}/.test(line)),
  ).toMatchInlineSnapshot(`
    [
      "     Failed  2 of 10 runs",
      "     Replay  vitest run raft.test.js -t '^one leader per term$' --seed 9 --replay-seed 3883915706fd6a1e:AQEAAwA",
    ]
  `)
})

test('the TAP report has the seed details', async () => {
  const { stdout } = await runSeededTests(
    {
      'raft.test.js': raftTests,
      // the replay fails with another id
      'users.test.js': /* js */ `
        import { expect, test } from 'vitest'

        let nextId = 1

        test('the first user gets the id 1', { repeats: 1 }, ({ random }) => {
          const user = { id: nextId++, name: random.pick(['ada', 'grace']) }
          expect(user.id).toBe(1)
        })
      `,
    },
    { reporters: ['tap'] },
  )
  expect(
    stdout
      .split('\n')
      .filter((line) => line.trimStart().startsWith('# '))
      .map(normalizeCommand)
      // the time of the search changes on every run
      .map((line) => line.replace(/runs \((\d+ms|\d+\.\d+s)\)/, 'runs (<time>)')),
  ).toMatchInlineSnapshot(`
    [
      "        # failed: 2 of 10 runs",
      "        # original: AssertionError: expected 2 to be 1 // Object.is equality",
      "        # shrunk: from 3 to 0 random values in 2 runs (<time>)",
      "        # values: random.int(150, 160) → 150 (raft.test.js:6:28)",
      "        #   random.int(150, 160) → 150 (raft.test.js:6:50)",
      "        #   random.int(150, 160) → 150 (raft.test.js:6:72)",
      "        # keep: seeds: ['d1d84a3ad3f37dda:AQEAAwA']",
      "        # replay: vitest run raft.test.js -t '^one leader per term$' --seed 0 --replay-seed d1d84a3ad3f37dda:AQEAAwA",
      "        # failed: 1 of 2 runs",
      "        # reproduced: no, the 2nd run failed with another error, so the test depends on more than its seed",
      "        #   AssertionError: expected 3 to be 1 // Object.is equality",
      "        # replay: vitest run users.test.js -t '^the first user gets the id 1$' --seed 0 --replay-seed ad8f82647547677d",
    ]
  `)
})

test('GitHub Actions shows the seeds of a failure in 1 annotation and in the job summary', async () => {
  const outputPath = resolve(tmpdir(), randomUUID())
  onTestFinished(() => rm(outputPath, { force: true }))
  const { stdout } = await runInlineTests(
    { 'raft.test.js': raftTests },
    {
      seed: 9,
      reporters: [
        new GithubActionsReporter({
          jobSummary: {
            enabled: true,
            outputPath,
            // GitHub Actions sets these values for the links in CI
            fileLinks: {
              repository: 'owner/repo',
              commitHash: 'aaa',
              workspacePath: process.cwd(),
            },
          },
        }),
      ],
    },
  )
  const annotations = stdout.split('\n').filter((line) => line.startsWith('::error'))
  expect(annotations).toHaveLength(1)
  const message = annotations[0].slice(annotations[0].indexOf('::', 2) + 2).replace(/%0A/g, '\n')
  expect(
    normalizeQuotes(message)
      .split('\n')
      .filter((line) => /^ +(Failed|Seeds?|Reproduced|Replay) {2}/.test(line)),
  ).toMatchInlineSnapshot(`
    [
      "     Failed  2 of 10 runs",
      "     Replay  vitest run raft.test.js -t '^one leader per term$' --seed 9 --replay-seed 3883915706fd6a1e:AQEAAwA",
    ]
  `)

  const summary = readFileSync(outputPath, 'utf-8')
  expect(summary.split('\n').find((line) => line.startsWith('- **Seed'))).toMatchInlineSnapshot(
    `"- **Seed**: 9"`,
  )
  expect(
    normalizeCommand(summary.slice(summary.indexOf('### Failed Seeds')))
      .replace(/vitest-test-[\w-]+/, '<root>')
      .trim(),
  ).toMatchInlineSnapshot(`
    "### Failed Seeds

    Each command runs the test again with the seed of \`context.random\` and \`vi.useFakeRandom()\` that failed.

    - [\`raft.test.js > one leader per term\`](https://github.com/owner/repo/blob/aaa/<root>/raft.test.js)

      \`\`\`sh
      vitest run raft.test.js -t '^one leader per term$' --seed 9 --replay-seed 3883915706fd6a1e:AQEAAwA
      \`\`\`"
  `)
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
      "     Replay  vitest run raft.test.js -t '^one leader per term$' --root <root> --test-timeout 5001 --maxWorkers=1 --seed 3 --replay-seed fe6075de2e41032f:AQEAAwA",
      "     Replay  vitest run election.test.js -t '^one leader per term$' --root <root> --test-timeout 5002 --maxWorkers=1 --seed 4 --replay-seed d60517f54361b5ea:AQEAAwA",
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
    `"     Replay  vitest run dice.test.js -t '^rolls a seven$' --seed 'nightly run' --replay-seed 532c0949e75ab538:AQEAAQA"`,
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
    `"     Replay  vitest run raft.test.js -t '^one leader per term$' --root <root> --config=<root>/vitest.e2e.config.js --test-timeout 5000 --no-file-parallelism --maxWorkers=1 --seed 0 --replay-seed d1d84a3ad3f37dda:AQEAAwA"`,
  )

  // the printed command fails with the same error, and `runVitestCli` adds `--maxWorkers=1` itself
  const [, ...args] = parseCommand(replayLine!.replace(/^ +Replay {2}/, ''))
  const replay = await runVitestCli(...args.filter((arg) => arg !== '--maxWorkers=1'))
  const errorLines = (output: string) =>
    output.split('\n').filter((line) => /^( FAIL|AssertionError)/.test(line))
  expect(errorLines(replay.stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  raft.test.js > one leader per term",
      "AssertionError: expected 3 to be 1 // Object.is equality",
    ]
  `)
  const errorMessage = (output: string) =>
    output.split('\n').find((line) => line.startsWith('AssertionError'))
  expect(errorMessage(replay.stderr)).toBe(errorMessage(stderr))
  expect(
    replay.stdout.split('\n').find((line) => line.includes('Replaying')),
  ).toMatchInlineSnapshot(`"      Replaying seed "d1d84a3ad3f37dda" with its tape"`)
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
      "repeat 0 retry 0 failed bd0108355e5910ba",
      "repeat 0 retry 1 skipped bd0108355e5910ba",
      "repeat 1 retry 0 skipped 4a6af139feb702d2",
    ]
  `)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  payments.test.js > charges the card in dollars",
      "     Failed  1 of 2 runs",
      " Reproduced  no, the 2nd run was skipped, so the test depends on more than its seed",
      "     Replay  vitest run payments.test.js -t '^charges the card in dollars$' --seed 0 --replay-seed bd0108355e5910ba",
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
        "repeat 0 retry 0 skipped 1e97d0263fe0c6de",
        "repeat 1 retry 0 failed 890c283ed85e2173",
        "repeat 1 retry 1 failed 890c283ed85e2173",
        "repeat 2 retry 0 failed 619e213dfe4f56b8",
        "repeat 2 retry 1 failed 619e213dfe4f56b8",
        "repeat 3 retry 0 passed 704d5cba7c32c410",
        "repeat 4 retry 0 failed dbffa9e679009235",
        "repeat 4 retry 1 failed dbffa9e679009235",
        "repeat 5 retry 0 skipped 1cd34d9cf6924a40",
      ],
      "shows the checkout in ap": [
        "skipped",
        "repeat 0 retry 0 skipped no seed",
        "repeat 1 retry 0 skipped no seed",
        "repeat 2 retry 0 skipped no seed",
      ],
      "shows the checkout in eu": [
        "passed",
        "repeat 0 retry 0 skipped be3c41f3675c8f6b",
        "repeat 1 retry 0 passed fd6b58f62513fb36",
        "repeat 2 retry 0 skipped fc84beb6ed9dd876",
        "repeat 3 retry 0 skipped 41412f6a4488c970",
        "repeat 4 retry 0 passed 850383b16ed2791b",
        "repeat 5 retry 0 skipped cac148cf2fa3c344",
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
      "     Failed  3 of 6 runs",
      "     Replay  vitest run checkout.test.js -t '^shows the checkout$' --seed 0 --replay-seed 890c283ed85e2173:AQEAAQHVqtWqBQ",
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
      "repeat 0 retry 0 failed 6bf5285b894f72cc",
      "repeat 0 retry 1 failed 6bf5285b894f72cc",
      "repeat 1 retry 0 skipped 5b515f41c00982b0",
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
        "repeat 0 retry 0 failed 8371af5bea2520f5",
        "repeat 0 retry 1 failed 8371af5bea2520f5",
        "repeat 1 retry 0 failed 750e9ca1d099ea49",
        "repeat 1 retry 1 failed 750e9ca1d099ea49",
        "repeat 2 retry 0 passed 4a1dede34e9740e7",
        "repeat 3 retry 0 passed 9ea2701f6d0e45f3",
      ]
    `)
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  tokens.test.js > accepts the tokens of the bug report",
      "     Failed  2 of 4 runs",
      "     Replay  vitest run tokens.test.js -t '^accepts the tokens of the bug report$' --seed 0 --replay-seed 8371af5bea2520f5",
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
      "te",
      "is",
      "nb",
      "yo",
    ]
  `)
  expect(formatAttempts(testCase)).toMatchInlineSnapshot(`
    [
      "repeat 0 retry 0 passed 98e482ca1be943ea",
      "repeat 1 retry 0 passed 869f421c24c6c369",
      "repeat 2 retry 0 passed 6efd6dd4d863270c",
      "repeat 3 retry 0 passed cf4dc76f5a74a5d2",
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
      test('sorts numbers', { repeats: 39 }, ({ random }) => {
        const numbers = Array.from({ length: 4 }, () => random.int(1, 6))
        expect(sortNumbers(numbers)).toHaveLength(4)
      })
    `,
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  sort.test.js > sorts numbers",
      "     Failed  29 of 40 runs",
      "     Replay  vitest run sort.test.js -t '^sorts numbers$' --seed 0 --replay-seed 2611d7dfd491209c:AQEABAA",
    ]
  `)
  expect(stderr.split('\n').length).toMatchInlineSnapshot(`23`)
})

test('seeds that fail at the same place with other values share 1 block', async () => {
  const { stderr } = await runSeededTests({
    'sort.test.js': /* js */ `
      import { expect, test } from 'vitest'

      // drops duplicate numbers by mistake
      function sortNumbers(numbers) {
        return [...new Set(numbers)].sort((a, b) => a - b)
      }

      test('keeps every number', { repeats: 39 }, ({ random }) => {
        const numbers = Array.from({ length: 4 }, () => random.int(1, 6))
        expect(sortNumbers(numbers)).toHaveLength(4)
      })
    `,
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    [
      " FAIL  sort.test.js > keeps every number",
      "     Failed  27 of 40 runs",
      "     Replay  vitest run sort.test.js -t '^keeps every number$' --seed 0 --replay-seed ce0e84838c7d8dce:AQEABAA",
    ]
  `)
  expect(stderr.split('\n').length).toMatchInlineSnapshot(`30`)
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
      '     Replay  vitest run queue.test.js -t "^queue \\(v2\\) > it\'s \\[fast\\] for \\`$1`$" --project unit --seed 5 --replay-seed 24fddfe49875cc1d:AQEAAQA',
    )
  }
  expect(normalizeQuotes(replay ?? '')).toMatchInlineSnapshot(
    `"     Replay  vitest run queue.test.js -t '^queue \\(v2\\) > it'\\''s \\[fast\\] for \\$1$' --project unit --seed 5 --replay-seed 178171048e30b42c:AQEAAQA"`,
  )
})

test('the repeats and seeds of a suite apply to each test in it', async () => {
  const { stderr, results } = await runSeededTests({
    'log.test.js': /* js */ `
      import { describe, test } from 'vitest'

      describe('log', { repeats: 1, seeds: ['0123456789abcdef'] }, () => {
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
        "56215104ee984e67",
        "740d0e8f238a7cef",
      ],
      "compacts": [
        "0123456789abcdef",
        "0cdab9234cc8d074",
        "038f145e92d8166a",
      ],
    }
  `)
})

test('a kept seed that is the seed of the test runs 1 time', async () => {
  const files = (repeats: string) => ({
    'raft.test.js': raftTests.replace(`{ repeats: 9 }`, repeats),
  })
  const withoutRepeats = await runSeededTests(files(`{}`))
  const [seed] = seedsOf(findTest(withoutRepeats.results, 'one leader per term'))
  const { results } = await runSeededTests(
    files(`{ repeats: 1, seeds: ['0123456789abcdef', '${seed}'] }`),
  )
  const seeds = seedsOf(findTest(results, 'one leader per term'))
  expect(seeds).toHaveLength(4)
  expect(new Set(seeds).size).toBe(4)
  expect(seeds.slice(0, 2)).toEqual(['0123456789abcdef', seed])
})

test('nullish values in the repeats and seeds options are the defaults', async () => {
  const { stderr, results } = await runSeededTests({
    'log.test.js': /* js */ `
      import { test } from 'vitest'

      test('appends', { repeats: 2, seeds: null }, ({ task, random }) => {
        task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
      })

      test('compacts', { repeats: undefined, seeds: ['0123456789abcdef'] }, ({ task, random }) => {
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
    {
      reporters: 'default',
      shrink: false,
      $cliOptions: { replaySeed: '5fd3dabb6d1efc9f', repeats: 3 },
    },
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
        const freeSeats = random.int(1, 2)
        const group = random.int(1, 2)
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
      "repeat 0 retry 0: 1 free seats, a group of 2",
      "repeat 1 retry 0: 1 free seats, a group of 2",
      "repeat 2 retry 0: 2 free seats, a group of 2",
      "repeat 2 retry 1: 2 free seats, a group of 2",
      "repeat 3 retry 0: 1 free seats, a group of 2",
      "repeat 4 retry 0: 2 free seats, a group of 1",
      "repeat 5 retry 0: 1 free seats, a group of 1",
      "repeat 5 retry 1: 1 free seats, a group of 1",
      "repeat 5 retry 1: 1 free seats, a group of 1",
    ]
  `)
  expect(stderr.split('\n').filter((line) => /^ +(↳ |Failed {2})/.test(line)))
    .toMatchInlineSnapshot(`
      [
        "   ↳ 2 free seats, a group of 2",
        "     Failed  2 of 6 runs",
      ]
    `)
})
