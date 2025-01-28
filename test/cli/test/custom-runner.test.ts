import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('can run custom runner with Vitest', async () => {
  const vitest = await runVitest({
    root: './fixtures/custom-runner',
    reporters: [['default', { isTTY: false }]],
    allowOnly: true,
  })

  expect(vitest.stderr).toMatchInlineSnapshot(`""`)

  expect(vitest.stdout).toContain('✓ custom-runner.test.ts')
  expect(vitest.stdout).toContain('Test Files  1 passed')
  expect(vitest.stdout).toContain('Tests  4 passed | 3 skipped')
})
