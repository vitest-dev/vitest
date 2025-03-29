import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

test('workspace project options are overriden by CLI options', async () => {
  const { stderr, stdout } = await runVitestCli(
    { nodeOptions: { cwd: './fixtures/browser-workspace' } },
    '--run',
    '--browser.provider=playwright',
    '--browser.isolate=false',
  )

  expect(stderr).toBe('')
  expect(stdout).toContain('✓  browser (chromium)  example.test.ts (1 test)')
  expect(stdout).toContain('Test Files  1 passed (1)')
})
