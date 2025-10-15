import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('excludes Vite transforms done for CJS dependency', async () => {
  await runVitest({
    include: ['fixtures/test/cjs-dependency.test.ts'],
    coverage: {
      reporter: 'json',
    },
  })
  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/cjs-dependency.ts",
    ]
  `)

  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/cjs-dependency.ts')

  // There should be 0 branches (#8717)
  expect(Object.keys(fileCoverage.b)).toHaveLength(0)
  expect(Object.keys(fileCoverage.branchMap)).toHaveLength(0)
})
