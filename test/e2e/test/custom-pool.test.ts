import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('can run custom pools with Vitest', async () => {
  const vitest = await runVitest({
    root: './fixtures/custom-pool',
    reporters: [['default', { isTTY: false }]],
  })

  expect(vitest.stderr).toMatchInlineSnapshot(`
    "[pool] printing: options are respected
    [pool] array option [ 1, 2, 3 ]
    [pool] running tests for custom-pool-test in /fixtures/custom-pool/tests/custom-not-run.spec.ts
    [pool] custom pool is closed!
    "
  `)

  expect(vitest.stdout).toContain('✓ |custom-pool-test| tests/custom-not-run.spec.ts')
  expect(vitest.stdout).toContain('✓ |threads-pool-test| tests/custom-run.threads.spec.ts')
  expect(vitest.stdout).toContain('Test Files  2 passed')
  expect(vitest.stdout).toContain('Tests  2 passed')
})

test('custom pool can deliver the first message while the worker registers its listener', async () => {
  const vitest = await runVitest({
    root: './fixtures/custom-pool-sync-transport',
    reporters: [['default', { isTTY: false }]],
  })

  expect(vitest.stderr).toBe('')
  expect(vitest.stdout).toContain('✓ |sync-transport-pool-test| tests/basic.spec.ts')
  expect(vitest.stdout).toContain('Test Files  1 passed')
  expect(vitest.stdout).toContain('Tests  1 passed')
})
