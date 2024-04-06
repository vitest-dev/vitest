import { expect, test } from 'vitest'
import libCoverage from 'istanbul-lib-coverage'

import { readCoverageJson } from './utils'

test('report contains only the changed files', async () => {
  const coverageJson = await readCoverageJson('./coverage/coverage-final.json')
  const coverageMap = libCoverage.createCoverageMap(coverageJson as any)

  // Note that this test may fail if you have new files in "vitest/test/coverage-test/src"
  // and have not yet committed those
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/src/file-to-change.ts",
      "<process-cwd>/src/new-uncovered-file.ts",
    ]
  `)

  const uncoveredFile = coverageMap.fileCoverageFor('<process-cwd>/src/new-uncovered-file.ts').toSummary()
  expect(uncoveredFile.lines.pct).toBe(0)

  const changedFile = coverageMap.fileCoverageFor('<process-cwd>/src/file-to-change.ts').toSummary()
  expect(changedFile.lines.pct).toBeGreaterThanOrEqual(50)
})
