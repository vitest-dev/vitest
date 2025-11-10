import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('cancels previous run before starting new one', async () => {
  const results: string[] = []

  const { ctx: vitest } = await runVitest({
    root: resolve(import.meta.dirname, '../fixtures/bail-race'),
    bail: 1,
    maxWorkers: 1,
    pool: 'threads',
    reporters: [{
      onTestCaseResult(testCase) {
        const result = testCase.result()

        results.push(`${result.state}${result.errors ? `: ${result.errors?.[0].message}` : ''}`)
      },
    }],
  })

  if (!vitest) {
    throw new Error('Vitest context is undefined')
  }

  let rounds = 0

  while (vitest.state.errorsSet.size === 0) {
    await vitest.start()

    if (rounds >= 2) {
      break
    }

    rounds++
  }

  expect(results).toMatchInlineSnapshot(`
    [
      "passed",
      "failed: expected 5 to be 6 // Object.is equality",
      "passed",
      "failed: expected 5 to be 6 // Object.is equality",
      "passed",
      "failed: expected 5 to be 6 // Object.is equality",
    ]
  `)
})
