import { resolve } from 'pathe'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'
import { StableTestFileOrderSorter } from '../../test-utils'

test('cancels previous run before starting new one', async () => {
  const errors: unknown[] = []

  const vitest = await createVitest('test', {
    maxWorkers: 1,
    maxConcurrency: 1,
    watch: false,
    bail: 1,
    root: resolve(import.meta.dirname, '../fixtures/bail-race'),
    sequence: { sequencer: StableTestFileOrderSorter },
    reporters: [{
      onTestRunEnd(_, unhandledErrors) {
        if (unhandledErrors.length) {
          errors.push(...unhandledErrors)
        }
      },
    }],
  })
  onTestFinished(() => vitest.close())

  for (let i = 0; i <= 4; i++) {
    await vitest.start()
  }

  // No "Error: [vitest-pool]: Cannot run tasks while pool is cancelling" errors should show up
  expect(errors).toHaveLength(0)
})
