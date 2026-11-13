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
  const first = await runInlineTests({ 'raft.test.js': raftTests }, { seed: 0 })
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
    { seed: 0, testNamePattern: 'replicates' },
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

  const withNewTest = await runInlineTests(
    {
      'raft.test.js': raftTests.replace(
        `describe('raft', () => {`,
        `describe('raft', () => {
  test('starts as a follower', ({ random }) => {
    expect(random.seed).toMatch(/^[0-9a-f]{16}$/)
  })
`,
      ),
    },
    { seed: 0 },
  )
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

test('each run gets a new seed, and the summary prints it', async () => {
  const first = await runInlineTests({ 'raft.test.js': raftTests })
  const second = await runInlineTests({ 'raft.test.js': raftTests })
  expect(first.stderr).toBe('')
  expect(second.stderr).toBe('')
  const runSeed = first.ctx!.getSeed()
  expect(runSeed).toMatch(/^\d+$/)
  expect(second.ctx!.getSeed()).not.toBe(runSeed)
  expect(testSeeds(second.results)).not.toEqual(testSeeds(first.results))
  expect(seedBanner(first.stdout)).toBe(`Running tests with seed "${runSeed}"`)
  expect(summarySeed(first.stdout)).toBe(runSeed)

  const repeatedRun = await runInlineTests({ 'raft.test.js': raftTests }, { seed: runSeed })
  expect(repeatedRun.stderr).toBe('')
  expect(summarySeed(repeatedRun.stdout)).toBe(runSeed)
  expect(testSeeds(repeatedRun.results)).toEqual(testSeeds(first.results))
  expect(repeatedRun.buildTree((testCase) => testCase.meta())).toEqual(
    first.buildTree((testCase) => testCase.meta()),
  )
})

test('any string is a seed, and a number is the same seed as its string', async () => {
  const files = { 'raft.test.js': raftTests }
  const commitRun = await runInlineTests(files, {
    seed: '9fd1f22a4c1e0b7d2f63a8e5c4b9d0a1e2f3c4b5',
  })
  expect(commitRun.stderr).toBe('')
  expect(summarySeed(commitRun.stdout)).toBe('9fd1f22a4c1e0b7d2f63a8e5c4b9d0a1e2f3c4b5')

  const numberRun = await runInlineTests(files, { seed: 42 })
  const stringRun = await runInlineTests(files, { seed: '42' })
  const zerosRun = await runInlineTests(files, { seed: '042' })
  expect(numberRun.ctx!.getSeed()).toBe('42')
  expect(testSeeds(stringRun.results)).toEqual(testSeeds(numberRun.results))
  expect(testSeeds(zerosRun.results)).not.toEqual(testSeeds(numberRun.results))
  expect(testSeeds(commitRun.results)).not.toEqual(testSeeds(numberRun.results))
})

test('"random" generates a new seed', async () => {
  const { stderr, stdout, ctx } = await runInlineTests(
    { 'raft.test.js': raftTests },
    { seed: 'random' },
  )
  expect(stderr).toBe('')
  expect(ctx!.getSeed()).toMatch(/^\d+$/)
  expect(summarySeed(stdout)).toBe(ctx!.getSeed())
})

test('the banner and the summary print the seed of every run', async () => {
  const { stderr, stdout, ctx } = await runInlineTests({
    'math.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('adds numbers', () => {
        expect(1 + 1).toBe(2)
      })
    `,
  })
  expect(stderr).toBe('')
  expect(seedBanner(stdout)).toBe(`Running tests with seed "${ctx!.getSeed()}"`)
  expect(summarySeed(stdout)).toBe(ctx!.getSeed())
})

test('a restart in watch mode keeps the seed', async () => {
  const { ctx, stderr } = await runInlineTests({ 'raft.test.js': raftTests }, { watch: true })
  expect(stderr).toBe('')
  const seed = ctx!.getSeed()
  await ctx!['_restart']('config')
  expect(ctx!.getSeed()).toBe(seed)
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

  const first = await runInlineTests(files, { seed: 0 })
  const second = await runInlineTests(files, { seed: 0 })
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
  expect(seedRun.ctx?.getSeed()).toBe('101')
  expect(runOrder(seedRun.stdout)).toMatchInlineSnapshot(`"3,1,5,4,2"`)

  const aliasRun = await runInlineTests(
    { 'log.test.js': shuffledTests },
    { sequence: { seed: 101, shuffle: true } },
  )
  expect(aliasRun.stderr).toMatchInlineSnapshot(`
    " DEPRECATED  \`sequence.seed\` is deprecated. Use the top-level \`seed\` option instead.
    "
  `)
  expect(aliasRun.ctx?.config.seed).toBe('101')
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

test('the seed of a shuffled run repeats the order', async () => {
  const shuffledRun = await runInlineTests(
    { 'log.test.js': shuffledTests },
    { sequence: { shuffle: true } },
  )
  expect(shuffledRun.stderr).toBe('')
  const seed = shuffledRun.ctx!.getSeed()
  expect(shuffledRun.ctx!.config.sequence.seed).toBeUndefined()
  expect(seedBanner(shuffledRun.stdout)).toBe(`Running tests with seed "${seed}"`)
  expect(summarySeed(shuffledRun.stdout)).toBe(seed)

  const repeatedRun = await runInlineTests(
    { 'log.test.js': shuffledTests },
    { seed, sequence: { shuffle: true } },
  )
  expect(repeatedRun.stderr).toBe('')
  expect(runOrder(repeatedRun.stdout)).toBe(runOrder(shuffledRun.stdout))
  expect(testSeeds(repeatedRun.results)).toEqual(testSeeds(shuffledRun.results))
})

test('projects get the seed of the root config', async () => {
  const { stderr, ctx } = await runInlineTests(
    { 'log.test.js': shuffledTests },
    {
      projects: [{ test: { name: 'node' } }, { test: { name: 'edge' } }],
    },
  )
  expect(stderr).toBe('')
  const seed = ctx!.getSeed()
  expect(ctx!.projects.map((project) => project.config.seed)).toEqual([seed, seed])
})

test('seed must be a non-empty string or a finite number', async () => {
  const errors: (string | undefined)[] = []
  for (const seed of ['', ' ', Number.POSITIVE_INFINITY]) {
    const { stderr } = await runInlineTests({ 'log.test.js': shuffledTests }, { seed })
    errors.push(stderr.split('\n').find((line) => line.includes('"seed"')))
  }
  expect(errors).toMatchInlineSnapshot(`
    [
      "TypeError: The "seed" option must be a non-empty string or a finite number, received "".",
      "TypeError: The "seed" option must be a non-empty string or a finite number, received " ".",
      "TypeError: The "seed" option must be a non-empty string or a finite number, received Infinity.",
    ]
  `)
})
