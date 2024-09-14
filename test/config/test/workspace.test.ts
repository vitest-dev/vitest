import { expect, it } from 'vitest'
import { resolve } from 'pathe'
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

it('correctly resolves workspace projects with a several folder globs', async () => {
  const { stderr, stdout } = await runVitest({
    root: 'fixtures/workspace/several-folders',
    workspace: './fixtures/workspace/several-folders/vitest.workspace.ts',
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('test - a')
  expect(stdout).toContain('test - b')
})

it('fails if project names are identical with a nice error message', async () => {
  const { stderr } = await runVitest({
    root: 'fixtures/workspace/invalid-duplicate-configs',
    workspace: './fixtures/workspace/invalid-duplicate-configs/vitest.workspace.ts',
  }, [], 'test', {}, { fails: true })
  expect(stderr).toContain(
    `Project name "test" from "vitest2.config.js" is not unique. The project is already defined by "vitest1.config.js".

Your config matched these files:
 - vitest1.config.js
 - vitest2.config.js

All projects in a workspace should have unique names. Make sure your configuration is correct.`,
  )
})

it('fails if project names are identical inside the inline config', async () => {
  const { stderr } = await runVitest({
    root: 'fixtures/workspace/invalid-duplicate-inline',
    workspace: './fixtures/workspace/invalid-duplicate-inline/vitest.workspace.ts',
  }, [], 'test', {}, { fails: true })
  expect(stderr).toContain(
    'Project name "test" is not unique. All projects in a workspace should have unique names. Make sure your configuration is correct.',
  )
})

it('fails if referenced file doesnt exist', async () => {
  const { stderr } = await runVitest({
    root: 'fixtures/workspace/invalid-non-existing-config',
    workspace: './fixtures/workspace/invalid-non-existing-config/vitest.workspace.ts',
  }, [], 'test', {}, { fails: true })
  expect(stderr).toContain(
    `Workspace config file "vitest.workspace.ts" references a non-existing file or a directory: ${resolve('fixtures/workspace/invalid-non-existing-config/vitest.config.js')}`,
  )
})
