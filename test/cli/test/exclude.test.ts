import { expect, test } from 'vitest'

import { runVitestCli } from '../../test-utils'

test('should test nothing', async () => {
  const { stderr } = await runVitestCli(
    'run',
    'fixtures/exclude/**.test.ts',
    '-c',
    'fixtures/exclude/vitest.exclude.config.ts',
    '--exclude',
    'fixtures/exclude/math.test.ts',
  )

  expect(stderr).toContain('No test files found, exiting with code 1')
})

test('should still test math.test.ts', async () => {
  const { stderr, stdout } = await runVitestCli(
    'run',
    'fixtures/exclude/**.test.ts',
    '-c',
    'fixtures/exclude/vitest.exclude.config.ts',
    '--exclude',
    'fixtures/exclude/string.test.ts',
  )

  expect(stdout).toContain(`✓ fixtures/exclude/math.test.ts`)
  expect(stderr).toBe('')
})
