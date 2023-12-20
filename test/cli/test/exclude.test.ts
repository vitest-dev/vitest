import { expect, test } from 'vitest'

import { runVitestCli } from '../../test-utils'

test('should still test math.test.ts', async () => {
  const { stderr, stdout } = await runVitestCli(
    'run',
    '--config',
    'fixtures/exclude/vitest.exclude.config.ts',
    '--exclude',
    'fixtures/exclude/string.test.ts',
  )

  expect(stdout).toContain(`✓ fixtures/exclude/math.test.ts`)
  expect(stdout).not.toContain(`string.test.ts`)
  expect(stderr).toBe('')
})
