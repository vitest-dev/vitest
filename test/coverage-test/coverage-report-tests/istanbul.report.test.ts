/*
 * Istanbul coverage provider specific test cases
 */

import { expect, test } from 'vitest'
import { readCoverageJson } from './utils'

test('istanbul json report', async () => {
  const jsonReport = await readCoverageJson()

  // If this fails, you can use "npx live-server@1.2.1 ./coverage" to see coverage report
  expect(jsonReport).toMatchSnapshot()
})

test('implicit else is included in branch count', async () => {
  const coverageMap = await readCoverageJson()

  const filename = '<process-cwd>/src/implicitElse.ts'
  const fileCoverage = coverageMap[filename]

  expect(fileCoverage.b).toHaveProperty('0')
  expect(fileCoverage.b['0']).toHaveLength(2)
})
