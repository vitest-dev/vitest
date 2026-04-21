import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('coverage files include all projects', async () => {
  await runVitest({
    config: '../../configs/vitest.config.workspace.ts',
    coverage: {
      reporter: ['json', 'html'],
      include: ['**/src/**'],
    },
    root: 'fixtures/workspaces/project',
  })

  const coverageMap = await readCoverageMap('fixtures/workspaces/project/coverage/coverage-final.json')
  const files = coverageMap.files()

  // All files from workspace should be picked
  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/workspaces/project/project1/src/id.ts",
      "<process-cwd>/fixtures/workspaces/project/project1/src/untested.ts",
      "<process-cwd>/fixtures/workspaces/project/project2/src/konst.ts",
      "<process-cwd>/fixtures/workspaces/project/project2/src/untested.ts",
      "<process-cwd>/fixtures/workspaces/project/shared/src/utils.ts",
    ]
  `)
})

test('coverage files limited to specified project', async () => {
  await runVitest({
    config: '../../configs/vitest.config.workspace.ts',
    coverage: {
      reporter: ['json', 'html'],
      include: ['**/src/**'],
    },
    project: 'project2',
    root: 'fixtures/workspaces/project',
  })

  const coverageMap = await readCoverageMap('fixtures/workspaces/project/coverage/coverage-final.json')
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/workspaces/project/project2/src/konst.ts",
      "<process-cwd>/fixtures/workspaces/project/project2/src/untested.ts",
    ]
  `)
})
