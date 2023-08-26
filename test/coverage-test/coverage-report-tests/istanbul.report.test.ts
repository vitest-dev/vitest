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

test('ignored code is excluded from the report', async () => {
  const functionName = 'ignoredFunction'
  const filename = '<process-cwd>/src/utils.ts'

  const coverageMap = await readCoverageJson()
  const fileCoverage = coverageMap[filename]

  // Function should not be included in report
  const functionCoverage = Object.values(fileCoverage.fnMap).find(fn => fn.name === functionName)
  expect(functionCoverage).toBe(undefined)

  // Function should still be found from the actual sources
  const utils = await import('../src/utils')
  expect(utils[functionName]).toBeTypeOf('function')
})

test('tests with multiple suites are covered', async () => {
  const coverageMap = await readCoverageJson()

  const filename = '<process-cwd>/src/multi-suite.ts'
  const fileCoverage = coverageMap[filename]

  // Assert that all functions are covered
  expect(fileCoverage.f).toMatchObject({
    0: 1,
    1: 1,
  })
})
