import type { InlineConfig } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests, runVitest } from '#test-utils'

function run(sequence: InlineConfig['sequence']) {
  return runVitest({
    sequence,
    include: [],
    standalone: true,
    watch: true,
  })
}

class CustomSequencer {
  sort() {
    return []
  }

  shard() {
    return []
  }
}

test.each([false, { files: false, tests: false }, { files: false, tests: true }])(
  'should use BaseSequencer if shuffle is %o',
  async (shuffle) => {
    const { ctx } = await run({ shuffle })
    expect(ctx?.config.sequence.sequencer.name).toBe('BaseSequencer')
  },
)

test.each([true, { files: true, tests: false }, { files: true, tests: true }])(
  'should use RandomSequencer if shuffle is %o',
  async (shuffle) => {
    const { ctx } = await run({ shuffle })
    expect(ctx?.config.sequence.sequencer.name).toBe('RandomSequencer')
  },
)

test.each([false, true, { files: true, tests: false }, { files: true, tests: true }])(
  'should always use CustomSequencer if passed',
  async (shuffle) => {
    const { ctx } = await run({ shuffle, sequencer: CustomSequencer })
    expect(ctx?.config.sequence.sequencer.name).toBe('CustomSequencer')
  },
)

test('shuffle with a known seed', async () => {
  const { stderr, errorTree } = await runInlineTests(
    {
      'basic.test.js': /* js */ `
      import { afterAll, describe, expect, test } from 'vitest'

      const numbers = []

      test.for([1, 2, 3, 4, 5])('test %s', (v) => {
        numbers.push(10 + v)
      })

      describe("inherit shuffle", () => {
        test.for([1, 2, 3, 4, 5])('test %s', (v) => {
          numbers.push(20 + v)
        })
      })

      describe('unshuffle', { shuffle: false }, () => {
        test.for([1, 2, 3, 4, 5])('test %s', (v) => {
          numbers.push(30 + v)
        })
      })

      afterAll(() => {
        expect(numbers).toEqual([
          24, 21, 23, 25, 22,
          31, 32, 33, 34, 35,
          13, 14, 12, 15, 11
        ])
      })
    `,
    },
    {
      seed: 101,
      sequence: {
        shuffle: true,
      },
    },
  )

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "inherit shuffle": {
          "test 1": "passed",
          "test 2": "passed",
          "test 3": "passed",
          "test 4": "passed",
          "test 5": "passed",
        },
        "test 1": "passed",
        "test 2": "passed",
        "test 3": "passed",
        "test 4": "passed",
        "test 5": "passed",
        "unshuffle": {
          "test 1": "passed",
          "test 2": "passed",
          "test 3": "passed",
          "test 4": "passed",
          "test 5": "passed",
        },
      },
    }
  `)
})

test('each suite gets its own order, and other suites do not change it', async () => {
  const raftTests = (otherSuite: string) => /* js */ `
    import { afterAll, describe, test } from 'vitest'

    const order = { election: [], replication: [] }
    ${otherSuite}
    describe('leader election', () => {
      test.for([1, 2, 3, 4, 5])('round %s', (round) => {
        order.election.push(round)
      })
    })

    describe('log replication', () => {
      test.for([1, 2, 3, 4, 5])('entry %s', (entry) => {
        order.replication.push(entry)
      })
    })

    afterAll(() => {
      console.log('order: ' + JSON.stringify(order))
    })
  `
  const config = { seed: 101, sequence: { shuffle: true } }
  const runOrder = (stdout: string) => stdout.match(/order: (.+)/)?.[1]

  const first = await runInlineTests({ 'raft.test.js': raftTests('') }, config)
  expect(first.stderr).toBe('')
  expect(runOrder(first.stdout)).toMatchInlineSnapshot(
    `"{"election":[3,1,4,2,5],"replication":[5,3,2,1,4]}"`,
  )

  const withOtherSuite = await runInlineTests(
    {
      'raft.test.js': raftTests(`
    describe('snapshots', () => {
      test('compacts the log', () => {})
      test('installs a snapshot on a follower', () => {})
    })
    `),
    },
    config,
  )
  expect(withOtherSuite.stderr).toBe('')
  expect(runOrder(withOtherSuite.stdout)).toBe(runOrder(first.stdout))
})

test('describe.shuffle without a shuffled config keeps its order until the seed changes', async () => {
  const files = {
    'raft.test.js': /* js */ `
      import { afterAll, describe, test } from 'vitest'

      const order = []

      describe.shuffle('leader election', () => {
        test.for([1, 2, 3, 4, 5])('round %s', (round) => {
          order.push(round)
        })
      })

      afterAll(() => {
        console.log('order: ' + order.join(','))
      })
    `,
  }
  const runOrder = (stdout: string) => stdout.match(/order: ([\d,]+)/)?.[1]

  const first = await runInlineTests(files)
  expect(first.stderr).toBe('')
  expect(first.ctx?.getSeed()).toBeNull()
  expect(runOrder(first.stdout)).toMatchInlineSnapshot(`"5,2,1,4,3"`)

  const second = await runInlineTests(files)
  expect(runOrder(second.stdout)).toBe(runOrder(first.stdout))

  const otherSeed = await runInlineTests(files, { seed: 42 })
  expect(runOrder(otherSeed.stdout)).not.toBe(runOrder(first.stdout))
})

test('should log seed when only shuffle.tests is enabled', async () => {
  const { stdout } = await runInlineTests(
    {
      'basic.test.js': /* js */ `
      import { test } from 'vitest'
      test('example', () => {})
    `,
    },
    {
      seed: 12345,
      sequence: {
        shuffle: { files: false, tests: true },
      },
    },
  )

  expect(stdout).toContain('Running tests with seed "12345"')
})

test('should log seed when shuffle is true', async () => {
  const { stdout } = await runInlineTests(
    {
      'basic.test.js': /* js */ `
      import { test } from 'vitest'
      test('example', () => {})
    `,
    },
    {
      seed: 67890,
      sequence: {
        shuffle: true,
      },
    },
  )

  expect(stdout).toContain('Running tests with seed "67890"')
})

test('should log seed when a project shuffles tests', async () => {
  const { stdout, ctx } = await runInlineTests(
    {
      'a.test.js': /* js */ `
      import { test } from 'vitest'
      test('example', () => {})
    `,
    },
    {
      projects: [{ test: { sequence: { shuffle: { tests: true } } } }],
    },
  )

  const seed = ctx?.getSeed()
  expect(seed).toEqual(expect.any(Number))
  expect(stdout).toContain(`Running tests with seed "${seed}"`)
})

test('should not log seed when shuffle is disabled', async () => {
  const { stdout, ctx } = await runInlineTests(
    {
      'basic.test.js': /* js */ `
      import { test } from 'vitest'
      test('example', () => {})
    `,
    },
    {
      sequence: {
        shuffle: false,
      },
    },
  )

  expect(ctx?.getSeed()).toBe(null)
  expect(stdout).not.toContain('Running tests with seed')
})
