import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('cancels previous run before starting new one', async () => {
  const results: Record<string, unknown>[] = []

  const { ctx: vitest, buildTestTree } = await runVitest({
    root: resolve(import.meta.dirname, '../fixtures/bail-race'),
    bail: 1,
    pool: 'threads',
    reporters: [{
      onTestRunEnd() {
        results.push(buildTestTree())
      },
    }],
  })

  if (!vitest) {
    throw new Error('Vitest context is not available')
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
      {
        "add.spec.js": {
          "adds two numbers": "passed",
          "fails adding two numbers": "failed",
        },
      },
      {
        "add.spec.js": {
          "adds two numbers": "passed",
          "fails adding two numbers": "failed",
        },
      },
      {
        "add.spec.js": {
          "adds two numbers": "passed",
          "fails adding two numbers": "failed",
        },
      },
    ]
  `)
})
