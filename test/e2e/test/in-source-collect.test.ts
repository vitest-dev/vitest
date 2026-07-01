import { expect, test } from 'vitest'
import { runInlineTests, StableTestFileOrderSorter, ts } from '../../test-utils'

// https://github.com/vitest-dev/vitest/issues/10577
test('in-source tests are collected when another test file has already put the source file in the module cache', async () => {
  const { stderr, testTree } = await runInlineTests({
    '1-math.test.ts': ts`
      import { expect, test } from 'vitest'
      import { add } from './2-math.js'

      test('add', () => {
        expect(add(1, 2)).toBe(3)
      })
    `,
    '2-math.ts': ts`
      export function add(a: number, b: number): number {
        return a + b
      }

      if (import.meta.vitest) {
        const { test, expect } = import.meta.vitest
        test('add in-source', () => {
          expect(add(1, 2)).toBe(3)
        })
      }
    `,
    'vitest.config.ts': {
      test: {
        includeSource: ['**/*.ts'],
        // keep all files in a single worker so `2-math.ts` stays in the module cache
        isolate: false,
        maxWorkers: 1,
      },
    },
  }, {
    sequence: { sequencer: StableTestFileOrderSorter },
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "1-math.test.ts": {
        "add": "passed",
      },
      "2-math.ts": {
        "add in-source": "passed",
      },
    }
  `)
})
