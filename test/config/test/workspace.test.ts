import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('correctly runs workspace tests when workspace config path is specified', async () => {
  const { stderr, stdout } = await runVitest({
    root: 'fixtures/workspace',
    workspace: 'nested/e2e.projects.js',
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('1 + 1 = 2')
  expect(stdout).not.toContain('2 + 2 = 4')
})

it('runs the workspace if there are several vitest config files', async () => {
  const { stderr, stdout } = await runVitest({
    root: 'fixtures/workspace/several-configs',
    workspace: './fixtures/workspace/several-configs/vitest.workspace.ts',
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('workspace/several-configs')
  expect(stdout).toContain('| 1_test')
  expect(stdout).toContain('| 2_test')
  expect(stdout).toContain('1 + 1 = 2')
  expect(stdout).toContain('2 + 2 = 4')
})
