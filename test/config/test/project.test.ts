import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test.each([
  { pattern: 'project_1', expected: ['project_1'] },
  { pattern: '*', expected: ['project_1', 'project_2', 'space_1'] },
  { pattern: '*j*', expected: ['project_1', 'project_2'] },
  { pattern: 'project*', expected: ['project_1', 'project_2'] },
  { pattern: 'space*', expected: ['space_1'] },
  { pattern: '!project_1', expected: ['project_2', 'space_1'] },
  { pattern: '!project*', expected: ['space_1'] },
  { pattern: '!project', expected: ['project_1', 'project_2', 'space_1'] },
])('should match projects correctly: $pattern', async ({ pattern, expected }) => {
  const { ctx } = await runVitest({
    root: 'fixtures/project',
    reporters: ['basic'],
    project: pattern,
  })

  expect(ctx?.projects.map(p => p.name).sort()).toEqual(expected)
})
