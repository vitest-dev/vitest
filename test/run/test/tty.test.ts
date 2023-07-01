import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

test('run mode does not get stuck when TTY', async () => {
  const vitest = await runVitestCli('--root', 'fixtures')
  await vitest.isDone

  expect(vitest.stdout).toContain('✓ example.test.ts')
  expect(vitest.stdout).toContain('✓ math.test.ts')
  expect(vitest.stdout).toContain('2 passed')

  // Regression #3642
  expect(vitest.stderr).not.toContain('close timed out')
  expect(vitest.stderr).toBe('')
})
