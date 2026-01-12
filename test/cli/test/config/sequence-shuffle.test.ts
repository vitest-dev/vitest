import type { InlineConfig } from 'vitest/node'
import { runInlineTests, runVitest } from '#test-utils'
import { expect, test } from 'vitest'

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

test.each([
  false,
  { files: false, tests: false },
  { files: false, tests: true },
],
)('should use BaseSequencer if shuffle is %o', async (shuffle) => {
  const { ctx } = await run({ shuffle })
  expect(ctx?.config.sequence.sequencer.name).toBe('BaseSequencer')
})

test.each([
  true,
  { files: true, tests: false },
  { files: true, tests: true },
])('should use RandomSequencer if shuffle is %o', async (shuffle) => {
  const { ctx } = await run({ shuffle })
  expect(ctx?.config.sequence.sequencer.name).toBe('RandomSequencer')
})

test.each([
  false,
  true,
  { files: true, tests: false },
  { files: true, tests: true },
])('should always use CustomSequencer if passed', async (shuffle) => {
  const { ctx } = await run({ shuffle, sequencer: CustomSequencer })
  expect(ctx?.config.sequence.sequencer.name).toBe('CustomSequencer')
})

test('shuffle with a known seed', async () => {
  const { stderr, errorTree } = await runInlineTests({
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
          11, 14, 13, 15, 12,
          31, 32, 33, 34, 35,
          21, 24, 23, 25, 22
        ])
      })
    `,
  }, {
    sequence: {
      seed: 101,
      shuffle: true,
    },
  })

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
