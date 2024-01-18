import { expect, it } from 'vitest'
import { runVitestCli } from '../../test-utils'

it('correctly runs workspace tests when workspace config path is specified', async () => {
  const { stderr, stdout } = await runVitestCli('run', '--root', 'fixtures/workspace', '--workspace', './nested/e2e.projects.js')
  expect(stderr).toBe('')
  expect(stdout).toContain('1 + 1 = 2')
  expect(stdout).not.toContain('2 + 2 = 4')
})
