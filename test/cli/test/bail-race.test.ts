import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('cancels previous run before starting new one', async () => {
  const results: string[] = []

it('should be able to bail fast without race conditions', async () => {
  // Arrange
  const abortController = new AbortController()
  const runPromise = Promise.resolve().then(async () => {
    const { ctx: vitest, buildTestTree } = await runVitest({ root, reporters: 'none', pool: 'threads' })

    // Act
    while (vitest!.state.errorsSet.size === 0 && !abortController.signal.aborted) {
      await vitest!.start()
      expect(buildTestTree()).toMatchInlineSnapshot(`
        {
          "src/add.spec.js": {
            "adds two numbers": "passed",
            "fails adding two numbers": "failed",
          },
        }
      `) // verify nothing strange happened
    }
    abortController.abort()
    if (vitest!.state.errorsSet.size > 0) {
      const msg = [...vitest!.state.errorsSet]
        .map(err => (err as Error).message)
        .join('\n')
      throw new Error(`Tests failed with bail:\n${msg}`)
    }
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
