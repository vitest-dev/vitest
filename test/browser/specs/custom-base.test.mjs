import assert from 'node:assert'
import test from 'node:test'
import { startVitest } from 'vitest/node'

test('custom-base', async () => {
  const vitest = await startVitest('test', [], {
    watch: false,
    root: 'fixtures/custom-base',
    browser: { headless: true },
    reporters: ['tap'],
  })
  assert.equal(vitest.state.getFiles()[0].result.state, 'pass')
})
