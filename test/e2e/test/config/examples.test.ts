import type { TestCase, TestModule } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '#test-utils'

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

// The time of shrinking changes on every run. The empty first and last lines put the quotes of an
// inline snapshot on their own lines.
function seedLines(stderr: string, filter?: (line: string) => boolean): string {
  const lines = stderr
    .replace(/^ +Replay {2}.*$/gm, normalizeCommand)
    .replace(/(try|tries) \((\d+ms|\d+\.\d+s)/g, '$1 (<time>')
    .split('\n')
    .filter(
      (line) =>
        /^ FAIL |^ +(Failed|Reproduced|Tape|Original|Shrunk|Values|Keep|Replay) {2}|^ {13} *\S/.test(
          line,
        ) &&
        (!filter || filter(line)),
    )
  return lines.length ? `\n${lines.join('\n')}\n` : ''
}

// the `Keep` detail of each failure
function keepLines(stderr: string): string {
  // the last line that is not the next line of a detail
  let key = ''
  return seedLines(stderr, (line) => {
    if (!line.startsWith(' '.repeat(13))) {
      key = line
    }
    return line.startsWith(' FAIL ') || /^ +Keep {2}/.test(key)
  })
}

function errorLines(stderr: string): string[] {
  return stderr.split('\n').filter((line) => /^(Type)?Error: /.test(line))
}

test('the examples run first, then the seeds and the repeats', async () => {
  const { stderr, results } = await runSeededTests({
    'queue.test.js': /* js */ `
      import { test } from 'vitest'

      test('the queue keeps every job', {
        repeats: 1,
        seeds: ['0123456789abcdef'],
        examples: [{ jobs: [501] }, { jobs: [] }],
      }, ({ task, random }) => {
        const jobs = random.many('jobs', () => random.int(0, 1000))
        task.meta.jobs = [...(task.meta.jobs ?? []), jobs]
      })
    `,
  })
  expect(stderr).toBe('')
  const testCase = findTest(results, 'the queue keeps every job')
  expect(testCase.meta().jobs).toMatchInlineSnapshot(`
    [
      [
        501,
      ],
      [],
      [
        906,
        76,
        875,
        762,
        683,
        509,
        875,
        933,
        623,
        667,
        679,
        689,
        93,
        89,
        544,
        492,
      ],
      [
        937,
        927,
      ],
      [
        154,
        16,
        184,
      ],
    ]
  `)
  expect(
    testCase.attempts().map(({ repeatIndex, example, seed }) => ({ repeatIndex, example, seed })),
  ).toMatchInlineSnapshot(`
    [
      {
        "example": 0,
        "repeatIndex": 0,
        "seed": undefined,
      },
      {
        "example": 1,
        "repeatIndex": 1,
        "seed": undefined,
      },
      {
        "example": undefined,
        "repeatIndex": 2,
        "seed": "0123456789abcdef",
      },
      {
        "example": undefined,
        "repeatIndex": 3,
        "seed": "505ea19c93ba8e71",
      },
      {
        "example": undefined,
        "repeatIndex": 4,
        "seed": "0b290332cfe8781c",
      },
    ]
  `)
})

test('an example gives the same values outside of its keys with any run seed', async () => {
  const files = {
    'users.test.js': /* js */ `
      import { test, vi } from 'vitest'

      test('a user gets an id', { examples: [{ user: { name: 'Alice' } }] }, ({ task, random }) => {
        vi.useFakeRandom()
        const user = random.span('user', () => ({ name: random.pick(['Bob', 'Carol']) }))
        const id = random.uuid()
        task.meta.runs = [...(task.meta.runs ?? []), { user, id, random: Math.random() }]
      })
    `,
  }
  const first = await runSeededTests(files, { seed: 0 })
  const second = await runSeededTests(files, { seed: 1 })
  expect(first.stderr).toBe('')
  expect(second.stderr).toBe('')
  const [firstExample, firstRun] = findTest(first.results, 'a user gets an id').meta().runs
  const [secondExample, secondRun] = findTest(second.results, 'a user gets an id').meta().runs
  expect(firstExample.user).toEqual({ name: 'Alice' })
  expect(secondExample).toEqual(firstExample)
  expect(secondRun).not.toEqual(firstRun)
})

test('an example gives its fake values to aroundEach and its fixtures, the same with any run seed', async () => {
  const files = {
    'users.test.js': /* js */ `
      import { test as base } from 'vitest'

      const test = base.extend({
        session: async ({}, use) => {
          await use({ id: crypto.randomUUID(), start: new Date().toISOString() })
        },
      })

      test.aroundEach(async (runTest, { task, session }) => {
        task.meta.runs = [...(task.meta.runs ?? []), { session, hook: Math.random() }]
        await runTest()
      })

      test('a user gets an id', {
        examples: [{ user: { name: 'Alice' } }],
        fakeRandom: true,
        fakeTimers: {
          now: { min: new Date('2024-01-01T00:00:00.000Z'), max: new Date('2024-12-31T23:59:59.999Z') },
        },
      }, ({ task, random }) => {
        const run = task.meta.runs.at(-1)
        run.user = random.span('user', () => ({ name: random.pick(['Bob', 'Carol']) }))
        run.test = Math.random()
      })
    `,
  }
  const first = await runSeededTests(files, { seed: 0 })
  const second = await runSeededTests(files, { seed: 1 })
  expect(first.stderr).toBe('')
  expect(second.stderr).toBe('')
  const [firstExample, firstRun] = findTest(first.results, 'a user gets an id').meta().runs
  const [secondExample, secondRun] = findTest(second.results, 'a user gets an id').meta().runs
  expect(firstExample).toMatchInlineSnapshot(`
    {
      "hook": 0.9861881168000063,
      "session": {
        "id": "23b81f43-56b8-4a9d-9912-c244ea406b38",
        "start": "2024-03-29T10:52:13.944Z",
      },
      "test": 0.9680489558924533,
      "user": {
        "name": "Alice",
      },
    }
  `)
  expect(secondExample).toEqual(firstExample)
  expect(secondRun).not.toEqual(firstRun)
})

test('the values of a fork are in an object, and a label that runs again takes them from $label', async () => {
  const { stderr, results } = await runSeededTests({
    'cluster.test.js': /* js */ `
      import { test } from 'vitest'

      test('a cluster elects a leader', {
        examples: [
          { network: { delay: 5 }, $user: ['first', 'second'] },
          { $user: ['only the first'] },
        ],
      }, ({ task, random }) => {
        const network = random.fork('network')
        const delay = network.span('delay', () => network.int(10, 100))
        const users = ['a', 'b', 'c'].map((name) => random.span('user', () => name))
        task.meta.runs = [...(task.meta.runs ?? []), { delay, users }]
      })
    `,
  })
  expect(stderr).toBe('')
  const runs = findTest(results, 'a cluster elects a leader').meta().runs
  expect(runs.slice(0, 2)).toMatchInlineSnapshot(`
    [
      {
        "delay": 5,
        "users": [
          "first",
          "second",
          "c",
        ],
      },
      {
        "delay": 12,
        "users": [
          "only the first",
          "b",
          "c",
        ],
      },
    ]
  `)
})

test('a keyed span does not run its function, so the spans inside it are not keys', async () => {
  const { stderr } = await runSeededTests({
    'orders.test.js': /* js */ `
      import { test } from 'vitest'

      test('an order has items', {
        examples: [{ order: { items: [] }, item: 'unused' }],
      }, ({ random }) => {
        random.span('order', () => ({ items: [random.span('item', () => 'book')] }))
      })
    `,
  })
  expect(errorLines(stderr)).toMatchInlineSnapshot(`
    [
      "Error: The 1st example has a key that no call used: "item". The run called random.span() or random.many() with "order".",
    ]
  `)
})

test('a key that no call used fails the test', async () => {
  const { stderr } = await runSeededTests({
    'queue.test.js': /* js */ `
      import { test } from 'vitest'

      test('the queue keeps every job', { examples: [{ jobz: [1] }] }, ({ random }) => {
        random.many('jobs', () => random.int(0, 1000))
      })

      test('the queue starts empty', { examples: [{ jobs: [] }] }, () => {})
    `,
  })
  expect(errorLines(stderr)).toMatchInlineSnapshot(`
    [
      "Error: The 1st example has a key that no call used: "jobz". The run called random.span() or random.many() with "jobs".",
      "Error: The 1st example has a key that no call used: "jobs". The run did not call random.span() or random.many().",
    ]
  `)
})

test('a key without $ for a label that runs again, and a key of a fork and a value fail the test', async () => {
  const { stderr } = await runSeededTests({
    'users.test.js': /* js */ `
      import { test } from 'vitest'

      test('users', { examples: [{ user: 'Alice' }] }, ({ random }) => {
        random.span('user', () => 'Bob')
        random.span('user', () => 'Carol')
      })
    `,
    'network.test.js': /* js */ `
      import { test } from 'vitest'

      test('network', { examples: [{ network: { delay: 5 } }] }, ({ random }) => {
        random.fork('network').span('delay', () => 1)
        random.span('network', () => 2)
      })
    `,
  })
  // files can run in any order
  expect(errorLines(stderr).sort()).toMatchInlineSnapshot(`
    [
      "Error: random.fork("network").span("delay") reads the example key "network" as the values of a fork, and random.span("network") reads it as a value. Rename 1 of the labels.",
      "Error: random.span("user") runs more than 1 time. Use "$user" in the example with 1 value for each call.",
    ]
  `)
})

test('the examples option rejects invalid values', async () => {
  const { stderr } = await runSeededTests({
    'object.test.js': `import { test } from 'vitest'; test('a', { examples: { jobs: [] } }, () => {})`,
    'entry.test.js': `import { test } from 'vitest'; test('a', { examples: [[1]] }, () => {})`,
    'keys.test.js': `import { test } from 'vitest'; test('a', { examples: [{ user: 1, $user: [2] }] }, () => {})`,
    'list.test.js': `import { test } from 'vitest'; test('a', { examples: [{ $user: 2 }] }, () => {})`,
    'empty.test.js': `import { test } from 'vitest'; test('a', { examples: [{ $user: [] }] }, () => {})`,
  })
  // files can run in any order
  expect(errorLines(stderr).sort()).toMatchInlineSnapshot(`
    [
      "TypeError: The "examples" option must be an array, received object.",
      "TypeError: The 1st example has the key "$user" with a value that is not an array, received number. Use an array with 1 value for each call.",
      "TypeError: The 1st example has the key "$user" with an empty array. Use an array with 1 value for each call.",
      "TypeError: The 1st example has the keys "user" and "$user". Use only "$user", with 1 value for each call.",
      "TypeError: The 1st example must be an object with the labels of random.span() and random.many() as keys.",
    ]
  `)
})

test('a suite does not give its examples to its tests', async () => {
  const { stderr, results } = await runSeededTests({
    'queue.test.js': /* js */ `
      import { describe, test } from 'vitest'

      describe('queue', { examples: [{ jobs: [501] }] }, () => {
        test('keeps every job', ({ task, random }) => {
          task.meta.jobs = random.many('jobs', () => random.int(0, 1000), { max: 2 })
        })
      })
    `,
  })
  expect(stderr).toBe('')
  const testCase = findTest(results, 'queue > keeps every job')
  expect(testCase.attempts()).toHaveLength(1)
  expect(testCase.meta().jobs).not.toEqual([501])
})

const queueTests = /* js */ `
import { expect, test } from 'vitest'

// a queue that drops the jobs above its size limit
function enqueue(jobs) {
  return jobs.filter((size) => size <= 500)
}

test('the queue keeps every job', { examples: [{ jobs: [501] }] }, ({ random }) => {
  const jobs = random.many('jobs', () => random.int(0, 500))
  expect(enqueue(jobs)).toEqual(jobs)
})
`

test('a failed example runs 1 time, is not searched and has no seed', async () => {
  const { stderr, results } = await runSeededTests({ 'queue.test.js': queueTests })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    "
     FAIL  queue.test.js > the queue keeps every job
         Failed  1 of 2 runs: 1st example
         Replay  vitest run queue.test.js -t '^the queue keeps every job$' --seed 0
    "
  `)
  const testCase = findTest(results, 'the queue keeps every job')
  expect(
    testCase
      .attempts()
      .map(({ state, example, seed, shrink }) => ({ state, example, seed, shrink })),
  ).toMatchInlineSnapshot(`
    [
      {
        "example": 0,
        "seed": undefined,
        "shrink": undefined,
        "state": "failed",
      },
      {
        "example": undefined,
        "seed": "505ea19c93ba8e71",
        "shrink": undefined,
        "state": "passed",
      },
    ]
  `)
})

test('a test that changes the values of its example has no `Reproduced` warning', async () => {
  const { stderr } = await runSeededTests({
    'queue.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('the queue has only small jobs', { examples: [{ jobs: [501, 20] }] }, ({ random }) => {
        const jobs = random.many('jobs', () => random.int(0, 500))
        while (jobs.length) {
          expect(jobs.shift()).toBeLessThan(500)
        }
      })
    `,
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    "
     FAIL  queue.test.js > the queue has only small jobs
         Failed  1 of 2 runs: 1st example
         Replay  vitest run queue.test.js -t '^the queue has only small jobs$' --seed 0
    "
  `)
})

test('the JSON report has no failed seed for an example', async () => {
  const { ctx } = await runSeededTests({ 'queue.test.js': queueTests })
  const testCase = findTest(ctx!.state.getTestModules(), 'the queue keeps every job')
  expect(ctx!._getTestFailureReport(testCase.task).failedSeeds).toEqual([])
})

test('the report names the failed examples by their numbers', async () => {
  const { ctx } = await runSeededTests({
    'queue.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('the queue keeps every job', {
        repeats: 1,
        examples: [{ jobs: [501] }, { jobs: [600] }, { jobs: [] }],
      }, ({ random }) => {
        const jobs = random.many('jobs', () => random.int(0, 500))
        expect(jobs.every((size) => size <= 500), 'a job is above the limit').toBe(true)
      })
    `,
  })
  const testCase = findTest(ctx!.state.getTestModules(), 'the queue keeps every job')
  const { failures } = ctx!._getTestFailureReport(testCase.task)
  const details = failures.map(({ details }) =>
    details.map((detail) =>
      detail.key === 'Replay' ? { ...detail, value: normalizeCommand(detail.value) } : detail,
    ),
  )
  expect(details).toMatchInlineSnapshot(`
    [
      [
        {
          "key": "Failed",
          "value": "2 of 5 runs: 1st example, 2nd example",
        },
        {
          "key": "Runs",
          "value": "examples 1-2",
        },
        {
          "key": "Replay",
          "value": "vitest run queue.test.js -t '^the queue keeps every job$' --seed 0",
        },
      ],
    ]
  `)
})

test('`Keep` prints an example only if the test read every value in an outer span', async () => {
  const { stderr } = await runSeededTests({
    'complete.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('an order is below the limit', { repeats: 30 }, ({ random }) => {
        const order = random.span('order', () => ({ total: random.int(0, 100), at: new Date(0) }))
        const tags = random.many('tags', () => random.pick(['gift', 'rush']), { max: 3 })
        expect(order.total + tags.length).toBeLessThan(50)
      })
    `,
    'fake-random.test.js': /* js */ `
      import { expect, test, vi } from 'vitest'

      test('a coupon has a small discount', { repeats: 30 }, ({ random }) => {
        vi.useFakeRandom()
        const code = random.span('code', () => random.int(0, 100))
        const discount = Math.random()
        expect(code + discount).toBeLessThan(code + 0.5)
      })
    `,
    'class.test.js': /* js */ `
      import { expect, test } from 'vitest'

      class Point {
        constructor(x) {
          this.x = x
        }
      }

      test('a point is near 0', { repeats: 30 }, ({ random }) => {
        const point = random.span('point', () => new Point(random.int(0, 100)))
        expect(point.x).toBeLessThan(10)
      })
    `,
  })
  expect(keepLines(stderr)).toMatchInlineSnapshot(`
    "
     FAIL  class.test.js > a point is near 0
           Keep  seeds: ['eb7c01712d2f5039:AQEAAQH47OLKAQ']
     FAIL  complete.test.js > an order is below the limit
           Keep  examples: [{
                   order: { total: 50, at: new Date('1970-01-01T00:00:00.000Z') },
                   tags: [],
                 }]
     FAIL  fake-random.test.js > a coupon has a small discount
           Keep  seeds: ['e0cf6e3f15ab0d41:AQIBDnZpdGVzdDpnbG9iYWxzAgGAgICACAABAA']
    "
  `)
})

test('`Keep` prints forks as objects and a label that runs again as $label', async () => {
  const { stderr } = await runSeededTests({
    'cluster.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('a message is delivered in time', { repeats: 9 }, ({ random }) => {
        const network = random.fork('network')
        const delay = network.span('delay', () => network.int(0, 100))
        const nodes = ['a', 'b', 'c'].map((name) =>
          random.span('node', () => ({ name, timeout: random.int(150, 300) })),
        )
        expect(delay + nodes.filter((node) => node.timeout > 200).length).toBeLessThan(50)
      })

      // the example key "network" would be both a value and the values of a fork
      test('a delay and a network are small', ({ random }) => {
        const delay = random.fork('network').span('delay', () => random.int(0, 100))
        const network = random.span('network', () => random.int(0, 100))
        expect(delay + network).toBeLessThan(50)
      })
    `,
  })
  expect(keepLines(stderr)).toMatchInlineSnapshot(`
    "
     FAIL  cluster.test.js > a message is delivered in time
           Keep  examples: [{
                   network: { delay: 50 },
                   $node: [
                     { name: 'a', timeout: 150 },
                     { name: 'b', timeout: 150 },
                     { name: 'c', timeout: 150 },
                   ],
                 }]
     FAIL  cluster.test.js > a delay and a network are small
           Keep  seeds: ['36ab3bc16cb2ef25:AQEAAgIA2KDu9Qc']
    "
  `)
})

test('an example of `Keep` gives the same keys when it is in the test', async () => {
  const createFile = (options: string) => ({
    'accounts.test.js': /* js */ `
      import { expect, test } from 'vitest'

      const ACCOUNT = '1234567890123456789'

      test('an account stays below its limit', ${options}, ({ random }) => {
        const balances = random.span('balances', () => ({ [ACCOUNT]: random.int(0, 1000) }))
        expect(balances[ACCOUNT]).toBeLessThan(500)
      })
    `,
  })
  const failed = await runSeededTests(createFile('{ repeats: 30 }'))
  expect(keepLines(failed.stderr)).toMatchInlineSnapshot(`
    "
     FAIL  accounts.test.js > an account stays below its limit
           Keep  examples: [{ balances: { '1234567890123456789': 500 } }]
    "
  `)
  const kept = /Keep {2}(examples: .*)/.exec(failed.stderr)?.[1]
  const { stderr } = await runSeededTests(createFile(`{ ${kept} }`))
  expect(stderr.split('\n').filter((line) => line.startsWith('AssertionError: ')))
    .toMatchInlineSnapshot(`
      [
        "AssertionError: expected 500 to be less than 500",
      ]
    `)
})

test('`Keep` prints the seed for an example with more than 30 lines', async () => {
  const createFiles = (jobs: number) => ({
    'batch.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('a batch has no empty job', { repeats: 20 }, ({ random }) => {
        const jobs = random.many(
          'jobs',
          () => ({ name: random.pick(['build', 'test']), size: random.int(0, 9) }),
          { min: ${jobs}, max: ${jobs} },
        )
        expect(jobs.every((job) => job.size > 0)).toBe(true)
      })
    `,
  })
  const full = await runSeededTests(createFiles(3))
  expect(keepLines(full.stderr)).toMatchInlineSnapshot(`
    "
     FAIL  batch.test.js > a batch has no empty job
           Keep  examples: [{
                   jobs: [
                     { name: 'build', size: 0 },
                     { name: 'build', size: 0 },
                     { name: 'build', size: 0 },
                   ],
                 }]
    "
  `)

  // 4 lines of brackets and 1 line for each job
  const cut = await runSeededTests(createFiles(27))
  expect(keepLines(cut.stderr)).toMatchInlineSnapshot(`
    "
     FAIL  batch.test.js > a batch has no empty job
           Keep  seeds: ['5ed9dbfb6181c9c4:AQEAUQA']
    "
  `)
})
