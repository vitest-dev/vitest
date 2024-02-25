import { expect, test } from 'vitest'

import { runVitestCli } from '../../test-utils'

test.each([
  'project*',
  'space*',
])('should match projects correctly: %s', async (project) => {
  const { stdout, stderr } = await runVitestCli(
    'run',
    '--root',
    'fixtures/project',
    '--project',
    project,
  )

  expect(stderr).toBeFalsy()
  expect(stdout).toBeTruthy()

  if (project === 'project*') {
    expect(stdout).toContain('project_1')
    expect(stdout).toContain('project_2')
    expect(stdout).not.toContain('space_1')
  }
  else {
    expect(stdout).toContain('space_1')
    expect(stdout).not.toContain('project_1')
    expect(stdout).not.toContain('project_2')
  }
})
