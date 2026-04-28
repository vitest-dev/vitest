import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

test('run mode does not get stuck when TTY', async () => {
  const { vitest } = await runVitestCli('--root', 'fixtures/tty')

  await vitest.waitForStdout('✓ example.test.ts')
  await vitest.waitForStdout('✓ math.test.ts')
  await vitest.waitForStdout('2 passed')

  // Regression #3642
  expect(vitest.stderr).not.toContain('close timed out')
  expect(vitest.stderr).toBe('')
})
