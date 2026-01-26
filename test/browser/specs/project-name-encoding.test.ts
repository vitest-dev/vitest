import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('runs tests correctly when project name contains special characters', async () => {
  const { stderr, stdout, exitCode } = await runBrowserTests({
    root: 'test/browser/fixtures/project-name-encoding',
  })

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(stdout).toContain('Test Files  1 passed')
  expect(stdout).toContain('Components & Hooks')
})
