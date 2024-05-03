import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('filter', async () => {
  const { stderr, stdout } = await runBrowserTests({
    testNamePattern: 'basic 2',
    reporters: ['verbose'],
  }, ['test/basic.test.ts'])

  expect(stderr).toBe('')
  expect(stdout).toContain('✓ test/basic.test.ts > basic 2')
  expect(stdout).toContain('Test Files  1 passed')
  expect(stdout).toContain('Tests  1 passed | 3 skipped')
})
