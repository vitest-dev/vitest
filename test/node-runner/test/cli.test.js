import test from 'node:test'
import { startVitest } from 'vitest/node'

await test('importing vitest in the global setup is reported as an error', async (t) => {
  const vitest = await startVitest('test', [], {
    root: './fixtures/globalSetup',
    globalSetup: [
      './failing.ts',
    ],
    reporters: [{}],
  })
  const modules = vitest.state.getTestModules()
  t.assert.equal(modules.length, 1)
  t.assert.equal(modules[0].state(), 'passed')
})
