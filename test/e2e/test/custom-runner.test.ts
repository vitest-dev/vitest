import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('extendTaskContext provides correct context.task.suite', async () => {
  const vitest = await runVitest({
    root: './fixtures/custom-runner',
    reporters: [['default', { isTTY: false }]],
  })
  expect(vitest.stderr).toBe('')
  expect(vitest.stdout).toContain('✓ custom-runner.test.ts')
})
