import { expect } from 'vitest'
import { isV8Provider, readCoverageMap, runVitest, test } from '../utils'

test('{ all: true } includes uncovered files that require custom transform', async () => {
  await runVitest({
    workspace: 'fixtures/configs/vitest.workspace.multi-transforms.ts',
    coverage: {
      all: true,
      extension: ['.ts', '.custom-1', '.custom-2'],
      reporter: ['json', 'html'],
      include: ['**/*.custom-1', '**/*.custom-2', '**/math.ts'],
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  // All files from workspace should be picked
  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/covered.custom-1",
      "<process-cwd>/fixtures/src/math.ts",
      "<process-cwd>/fixtures/src/uncovered.custom-1",
      "<process-cwd>/fixtures/workspaces/custom-2/src/covered.custom-2",
      "<process-cwd>/fixtures/workspaces/custom-2/src/uncovered.custom-2",
    ]
  `)

  const covered1 = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/covered.custom-1')
  const uncovered1 = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/uncovered.custom-1')
  const covered2 = coverageMap.fileCoverageFor('<process-cwd>/fixtures/workspaces/custom-2/src/covered.custom-2')
  const uncovered2 = coverageMap.fileCoverageFor('<process-cwd>/fixtures/workspaces/custom-2/src/uncovered.custom-2')

  // Coverage maps indicate whether source maps are correct. Check html-report if these change
  await expect(JSON.stringify(covered1, null, 2)).toMatchFileSnapshot(snapshotName('covered-1'))
  await expect(JSON.stringify(uncovered1, null, 2)).toMatchFileSnapshot(snapshotName('uncovered-1'))
  await expect(JSON.stringify(covered2, null, 2)).toMatchFileSnapshot(snapshotName('covered-2'))
  await expect(JSON.stringify(uncovered2, null, 2)).toMatchFileSnapshot(snapshotName('uncovered-2'))
})

function snapshotName(label: string) {
  return `__snapshots__/custom-file-${label}-${isV8Provider() ? 'v8' : 'istanbul'}.snapshot.json`
}
