/*
 * C8 coverage provider specific test cases
 */

import { expect, test } from 'vitest'
import { readCoverageJson } from './utils'

test('c8 json report', async () => {
  const jsonReport = await readCoverageJson()

  // If this fails, you can use "npx live-server@1.2.1 ./coverage" to see coverage report
  expect(jsonReport).toMatchSnapshot()
})

test('ignored code is marked as covered in the report', async () => {
  const functionName = 'ignoredFunction'
  const filename = '<process-cwd>/src/utils.ts'

  const coverageMap = await readCoverageJson()
  const fileCoverage = coverageMap[filename]

  const [functionKey] = Object.entries(fileCoverage.fnMap).find(([, fn]) => fn.name === functionName)!
  const functionCallCount = fileCoverage.f[functionKey]

  // C8 marks excluded lines as covered, instead of removing them from report completely
  expect(functionCallCount).toBe(1)

  // Function should still be found from the actual sources
  const utils = await import('../src/utils')
  expect(utils[functionName]).toBeTypeOf('function')
})
