import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

const allProjects = ['project_1', 'project_2', 'space_1']

test.each([
  { pattern: 'project_1', expected: ['project_1'] },
  { pattern: '*', expected: allProjects },
  { pattern: '*j*', expected: ['project_1', 'project_2'] },
  { pattern: 'project*', expected: ['project_1', 'project_2'] },
  { pattern: 'space*', expected: ['space_1'] },
  { pattern: '!project_1', expected: ['project_2', 'space_1'] },
  { pattern: '!project*', expected: ['space_1'] },
  { pattern: '!project', expected: allProjects },
])('should match projects correctly: $pattern', async ({ pattern, expected }) => {
  const { ctx, stderr, stdout } = await runVitest({
    root: 'fixtures/project',
    reporters: ['basic'],
    project: pattern,
  })

  expect(stderr).toBeFalsy()
  expect(stdout).toBeTruthy()

  for (const project of allProjects) {
    if (expected.includes(project)) {
      expect(stdout).toContain(project)
    }
    else {
      expect(stdout).not.toContain(project)
    }
  }

  expect(ctx?.projects.map(p => p.name).sort()).toEqual(expected)
})
