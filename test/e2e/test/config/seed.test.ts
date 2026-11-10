import type { TestModule } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '#test-utils'

const raftTests = /* js */ `
import { describe, expect, test } from 'vitest'

describe('raft', () => {
  test('elects one leader', ({ task, random }) => {
    task.meta.votes = random.int(0, 4)
  })

  test('replicates the log', ({ task, random }) => {
    task.meta.seed = random.seed
  })

  test('does not use random values', () => {
    expect(1 + 1).toBe(2)
  })
})
`

function seedBanner(stdout: string) {
  return stdout
    .split('\n')
    .find((line) => line.includes('Running tests with seed'))
    ?.trim()
}

function summarySeed(stdout: string) {
  return stdout.match(/^ +Seed {2}(\S+)$/m)?.[1]
}

function testSeeds(modules: TestModule[]) {
  return Object.fromEntries(
    modules.flatMap((module) =>
      [...module.children.allTests()].map((testCase) => [
        testCase.fullName,
        testCase.attempts().map((attempt) => attempt.seed ?? null),
      ]),
    ),
  )
}

test('a test keeps its seed with filters, shuffle and new tests above it', async () => {
  const first = await runInlineTests({ 'raft.test.js': raftTests })
  expect(first.stderr).toBe('')
  expect(testSeeds(first.results)).toMatchInlineSnapshot(`
    {
      "raft > does not use random values": [
        null,
      ],
      "raft > elects one leader": [
        "aae92fc53aaa1d2e",
      ],
      "raft > replicates the log": [
        "6bcc30960a76ab16",
      ],
    }
  `)

  const filtered = await runInlineTests(
    { 'raft.test.js': raftTests },
    { testNamePattern: 'replicates' },
  )
  expect(filtered.stderr).toBe('')
  expect(testSeeds(filtered.results)['raft > replicates the log']).toEqual(
    testSeeds(first.results)['raft > replicates the log'],
  )

  const shuffled = await runInlineTests(
    { 'raft.test.js': raftTests },
    { seed: 0, sequence: { shuffle: true } },
  )
  expect(shuffled.stderr).toBe('')
  expect(testSeeds(shuffled.results)).toEqual(testSeeds(first.results))

  const withNewTest = await runInlineTests({
    'raft.test.js': raftTests.replace(
      `describe('raft', () => {`,
      `describe('raft', () => {
  test('starts as a follower', ({ random }) => {
    expect(random.seed).toMatch(/^[0-9a-f]{16}$/)
  })
`,
    ),
  })
  expect(withNewTest.stderr).toBe('')
  const { 'raft > starts as a follower': _, ...seedsWithNewTest } = testSeeds(withNewTest.results)
  expect(seedsWithNewTest).toEqual(testSeeds(first.results))
})

test('tests with the same full name get different seeds', async () => {
  const { stderr, results } = await runInlineTests({
    'leader.test.js': /* js */ `
      import { describe, test } from 'vitest'

      test('reconnects', ({ random }) => {})
      test('reconnects', ({ random }) => {})

      describe('leader', () => {
        test('steps down', ({ random }) => {})
      })
      describe('leader', () => {
        test('steps down', ({ random }) => {})
      })
      test('leader > steps down', ({ random }) => {})
    `,
  })
  expect(stderr).toBe('')
  const seeds = [...results[0].children.allTests()].map((testCase) => testCase.attempts()[0].seed)
  expect(seeds).toHaveLength(5)
  expect(new Set(seeds).size).toBe(5)
})

test('projects get different seeds', async () => {
  const { stderr, results } = await runInlineTests(
    {
      'raft.test.js': raftTests,
    },
    {
      projects: [{ test: { name: 'node' } }, { test: { name: 'edge' } }],
    },
  )
  expect(stderr).toBe('')
  const seeds = results.map((module) => ({
    project: module.project.name,
    seed: testSeeds([module])['raft > replicates the log'],
  }))
  expect(seeds).toHaveLength(2)
  expect(seeds[0].seed).not.toEqual(seeds[1].seed)
})

test('the run seed changes the seeds and "random" prints the run seed', async () => {
  const defaultRun = await runInlineTests({ 'raft.test.js': raftTests })
  const fixedRun = await runInlineTests({ 'raft.test.js': raftTests }, { seed: 42 })
  expect(fixedRun.stderr).toBe('')
  expect(seedBanner(fixedRun.stdout)).toBe('Running tests with seed "42"')
  expect(summarySeed(fixedRun.stdout)).toBe('42')
  expect(testSeeds(fixedRun.results)).not.toEqual(testSeeds(defaultRun.results))
  expect(seedBanner(defaultRun.stdout)).toBeUndefined()
  expect(summarySeed(defaultRun.stdout)).toBeUndefined()

  const randomRun = await runInlineTests({ 'raft.test.js': raftTests }, { seed: 'random' })
  expect(randomRun.stderr).toBe('')
  const runSeed = seedBanner(randomRun.stdout)?.match(/seed "(\d+)"$/)?.[1]
  expect(runSeed).toMatch(/^\d+$/)
  expect(summarySeed(randomRun.stdout)).toBe(runSeed)

  const repeatedRun = await runInlineTests({ 'raft.test.js': raftTests }, { seed: Number(runSeed) })
  expect(repeatedRun.stderr).toBe('')
  expect(testSeeds(repeatedRun.results)).toEqual(testSeeds(randomRun.results))
  expect(repeatedRun.buildTree((testCase) => testCase.meta())).toEqual(
    randomRun.buildTree((testCase) => testCase.meta()),
  )
})

test('each retry starts the random values again from the seed', async () => {
  const { stderr, results, testTree } = await runInlineTests({
    'retry.test.js': /* js */ `
      import { expect, test } from 'vitest'

      const delays = []

      test('backs off after a failed request', { retry: 1 }, ({ random }) => {
        delays.push(random.int(100, 1_000))
        if (delays.length === 1) {
          throw new Error('the first request fails')
        }
        expect(delays[1]).toBe(delays[0])
      })
    `,
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "retry.test.js": {
        "backs off after a failed request": "passed",
      },
    }
  `)
  const [first, second] = testSeeds(results)['backs off after a failed request']
  expect(first).toMatch(/^[0-9a-f]{16}$/)
  expect(second).toBe(first)
})

test('fast-check repeats its runs with a seed from a fork of random', async () => {
  const files = {
    'sort.test.js': /* js */ `
      import * as fc from 'fast-check'
      import { expect, test } from 'vitest'

      test('sorts numbers', ({ random, task }) => {
        const inputs = []
        fc.assert(
          fc.property(fc.array(fc.integer()), (numbers) => {
            inputs.push(numbers)
            expect([...numbers].sort((a, b) => a - b)).toHaveLength(numbers.length)
          }),
          { seed: random.fork('fast-check').uint32() | 0, numRuns: 5 },
        )
        task.meta.inputs = JSON.stringify(inputs)
      })
    `,
  }
  const inputs = (modules: TestModule[]) => [...modules[0].children.allTests()][0].meta().inputs

  const first = await runInlineTests(files)
  const second = await runInlineTests(files)
  const seeded = await runInlineTests(files, { seed: 42 })
  expect(first.stderr).toBe('')
  expect(second.stderr).toBe('')
  expect(seeded.stderr).toBe('')
  expect(inputs(first.results)).toEqual(expect.any(String))
  expect(inputs(second.results)).toBe(inputs(first.results))
  expect(inputs(seeded.results)).not.toBe(inputs(first.results))
})

test('fixtures can use random, and a user fixture with the same name replaces it', async () => {
  const { stderr, testTree } = await runInlineTests({
    'fixtures.test.js': /* js */ `
      import { expect, test } from 'vitest'

      const clusterTest = test.extend({
        leader: ({ random }, use) => use(random.pick(['node-1', 'node-2', 'node-3'])),
      })

      clusterTest('uses random in a fixture', ({ leader, random }) => {
        expect(leader).toMatch(/^node-[123]$/)
        const { int } = random
        expect(int(1, 1)).toBe(1)
      })

      const fixedTest = test.extend({ seed: 'user value', random: 4 })

      fixedTest('a user fixture replaces the built-in value', ({ seed, random }) => {
        expect(seed).toBe('user value')
        expect(random).toBe(4)
      })

      test('the context has no seed value', (context) => {
        expect('seed' in context).toBe(false)
      })
    `,
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "fixtures.test.js": {
        "a user fixture replaces the built-in value": "passed",
        "the context has no seed value": "passed",
        "uses random in a fixture": "passed",
      },
    }
  `)
})

test('a user fixture named random gets the built-in value again on each retry', async () => {
  const { stderr, testTree } = await runInlineTests({
    'retry.test.js': /* js */ `
      import { expect, test as baseTest } from 'vitest'

      const test = baseTest.extend('random', ({ random }) => {
        return { backoff: () => random.int(100, 1_000) }
      })

      const delays = []

      test('backs off after a failed request', { retry: 1 }, ({ random }) => {
        delays.push(random.backoff())
        if (delays.length === 1) {
          throw new Error('the first request fails')
        }
        expect(delays[1]).toBe(delays[0])
      })
    `,
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "retry.test.js": {
        "backs off after a failed request": "passed",
      },
    }
  `)
})

const shuffledTests = /* js */ `
import { afterAll, describe, test } from 'vitest'

const order = []

describe('append entries', () => {
  test.for([1, 2, 3, 4, 5])('entry %s', (entry, { random }) => {
    order.push(entry)
    random.int(0, 9)
  })
})

afterAll(() => {
  console.log('order: ' + order.join(','))
})
`

function runOrder(stdout: string) {
  return stdout.match(/order: ([\d,]+)/)?.[1]
}

test('seed sets the order of shuffled tests, and wins over sequence.seed', async () => {
  const seedRun = await runInlineTests(
    { 'log.test.js': shuffledTests },
    { seed: 101, sequence: { shuffle: true } },
  )
  expect(seedRun.stderr).toBe('')
  expect(seedRun.ctx?.getSeed()).toBe(101)
  expect(runOrder(seedRun.stdout)).toMatchInlineSnapshot(`"3,1,5,4,2"`)

  const aliasRun = await runInlineTests(
    { 'log.test.js': shuffledTests },
    { sequence: { seed: 101, shuffle: true } },
  )
  expect(aliasRun.stderr).toMatchInlineSnapshot(`
    " DEPRECATED  \`sequence.seed\` is deprecated. Use the top-level \`seed\` option instead.
    "
  `)
  expect(aliasRun.ctx?.config.seed).toBe(101)
  expect(runOrder(aliasRun.stdout)).toBe(runOrder(seedRun.stdout))
  expect(testSeeds(aliasRun.results)).toEqual(testSeeds(seedRun.results))

  const bothRun = await runInlineTests(
    { 'log.test.js': shuffledTests },
    { seed: 101, sequence: { seed: 5, shuffle: true } },
  )
  expect(bothRun.stderr).toBe(aliasRun.stderr)
  expect(runOrder(bothRun.stdout)).toBe(runOrder(seedRun.stdout))
  expect(testSeeds(bothRun.results)).toEqual(testSeeds(seedRun.results))
})

test('sequence.seed prints one deprecation warning, also with projects', async () => {
  const { stderr } = await runInlineTests(
    { 'log.test.js': shuffledTests },
    {
      sequence: { seed: 101 },
      projects: [{ test: { name: 'node' } }, { test: { name: 'edge' } }],
    },
  )
  expect(stderr).toMatchInlineSnapshot(`
    " DEPRECATED  \`sequence.seed\` is deprecated. Use the top-level \`seed\` option instead.
    "
  `)
})

test('a shuffled run without a seed uses one random seed for the order and the values', async () => {
  const fixedRun = await runInlineTests({ 'log.test.js': shuffledTests })
  expect(fixedRun.stderr).toBe('')
  expect(fixedRun.ctx?.config.seed).toBeUndefined()
  expect(fixedRun.ctx?.getSeed()).toBeNull()
  expect(seedBanner(fixedRun.stdout)).toBeUndefined()
  expect(summarySeed(fixedRun.stdout)).toBeUndefined()

  const shuffledRun = await runInlineTests(
    { 'log.test.js': shuffledTests },
    { sequence: { shuffle: true } },
  )
  expect(shuffledRun.stderr).toBe('')
  const seed = shuffledRun.ctx?.getSeed()
  expect(seed).toEqual(expect.any(Number))
  expect(shuffledRun.ctx?.config.sequence.seed).toBe(seed)
  expect(seedBanner(shuffledRun.stdout)).toBe(`Running tests with seed "${seed}"`)
  expect(summarySeed(shuffledRun.stdout)).toBe(String(seed))
  expect(testSeeds(shuffledRun.results)).not.toEqual(testSeeds(fixedRun.results))

  const repeatedRun = await runInlineTests(
    { 'log.test.js': shuffledTests },
    { seed: seed!, sequence: { shuffle: true } },
  )
  expect(repeatedRun.stderr).toBe('')
  expect(runOrder(repeatedRun.stdout)).toBe(runOrder(shuffledRun.stdout))
  expect(testSeeds(repeatedRun.results)).toEqual(testSeeds(shuffledRun.results))
})

test('the projects of a shuffled run get the random seed in their config', async () => {
  const { stderr, ctx } = await runInlineTests(
    { 'log.test.js': shuffledTests },
    {
      sequence: { shuffle: true },
      projects: [{ test: { name: 'node' } }, { test: { name: 'edge' } }],
    },
  )
  expect(stderr).toBe('')
  const seed = ctx?.getSeed()
  expect(seed).toEqual(expect.any(Number))
  expect(ctx?.projects.map((project) => project.config.seed)).toEqual([seed, seed])
})

test('seed must be a number or "random"', async () => {
  const { stderr } = await runInlineTests(
    { 'log.test.js': shuffledTests },
    // @ts-expect-error the seed is not a number
    { seed: 'nightly' },
  )
  expect(stderr.split('\n').find((line) => line.includes('"seed"'))).toMatchInlineSnapshot(
    `"TypeError: The "seed" option must be a number or "random", received "nightly"."`,
  )
})
