import { join } from 'node:path'
import { expect, it } from 'vitest'

import { editFile, resolvePath, runVitestCli } from '../../test-utils'

it('doesn\'t run any test in a workspace because there are no changes', async () => {
  const { stdout } = await runVitestCli('--root', join(process.cwd(), './fixtures/workspace'), '--no-watch', '--changed')
  expect(stdout).toContain('No test files found, exiting with code 0')
})

// Fixes #4674
it('related correctly runs only related tests inside a workspace', async () => {
  editFile(resolvePath(import.meta.url, '../fixtures/workspace/packages/packageA/index.js'), content => `${content}\n`)
  const { stdout, stderr } = await runVitestCli('--root', join(process.cwd(), './fixtures/workspace'), '--no-watch', '--changed')
  expect(stderr).toBe('')
  expect(stdout).toContain('1 passed')
  expect(stdout).toContain('packageA')
  expect(stdout).not.toContain('packageB')
})
