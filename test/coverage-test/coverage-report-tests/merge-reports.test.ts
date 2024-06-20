import { expect, test } from 'vitest'
import libCoverage from 'istanbul-lib-coverage'

import { readCoverageJson } from '../coverage-report-tests/utils'

test('reports are merged', async () => {
  const json = await readCoverageJson('./coverage/coverage-final.json')
  const coverageMap = libCoverage.createCoverageMap(json as any)
  const files = coverageMap.files()

  // Two files were covered: 2/3 cases covered utils, 1/3 covered importEnv
  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/src/importEnv.ts",
      "<process-cwd>/src/utils.ts",
    ]
  `)

  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/src/utils.ts')
  const lines = fileCoverage.getLineCoverage()

  // add() should be covered by one test file
  expect(lines[2]).toBe(1)

  // multiply() should be covered by two test files
  expect(lines[6]).toBe(2)
})
