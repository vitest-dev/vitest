import { expect, test } from 'vitest'

import { runVitest } from '../../test-utils'

test('should run suites and tests concurrently unless concurrent false is specified when sequence.concurrent is true', async () => {
  const { stderr, errorTree } = await runVitest({
    root: './fixtures/sequence-concurrent',
    include: [
      'sequence-concurrent-true-concurrent.test.ts',
      'sequence-concurrent-true-concurrent-false.test.ts',
    ],
    sequence: {
      concurrent: true,
    },
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "sequence-concurrent-true-concurrent-false.test.ts": {
        "last test completes last": "passed",
        "sequential suite": {
          "first test completes first": "passed",
          "second test completes second": "passed",
        },
        "third test completes third": "passed",
      },
      "sequence-concurrent-true-concurrent.test.ts": {
        "concurrent suite": {
          "first test completes last": "passed",
          "second test completes third": "passed",
        },
        "last test completes first": "passed",
        "third test completes second": "passed",
      },
    }
  `)
})

test('should run suites and tests sequentially unless concurrent specified when sequence.concurrent is false', async () => {
  const { stderr, errorTree } = await runVitest({
    root: './fixtures/sequence-concurrent',
    include: ['sequence-concurrent-false-*.test.ts'],
    sequence: {
      concurrent: false,
    },
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "sequence-concurrent-false-concurrent.test.ts": {
        "concurrent suite": {
          "first test completes last": "passed",
          "second test completes third": "passed",
        },
        "last test completes first": "passed",
        "third test completes second": "passed",
      },
      "sequence-concurrent-false-sequential.test.ts": {
        "last test completes last": "passed",
        "sequential suite": {
          "first test completes first": "passed",
          "second test completes second": "passed",
        },
        "third test completes third": "passed",
      },
    }
  `)
})
