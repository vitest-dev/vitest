import { existsSync, readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import libCoverage from 'istanbul-lib-coverage'
import { resolve } from 'pathe'

test('coverage exists', () => {
  expect(existsSync('./coverage')).toBe(true)
  expect(existsSync('./coverage/index.html')).toBe(true)
})

test('file coverage summary matches', () => {
  const coverageJson = JSON.parse(readFileSync('./coverage/coverage-final.json', 'utf-8'))
  const coverageMap = libCoverage.createCoverageMap(coverageJson)
  const fileCoverage = coverageMap.fileCoverageFor(resolve('./src/math.ts'))

  // There should be 1 uncovered branch and 1 uncovered function. See math.ts.
  const { branches, functions } = fileCoverage.toSummary()

  expect(branches.total - branches.covered).toBe(1)
  expect(functions.total - functions.covered).toBe(1)
})

test('coverage of file transformed by multiple plugins is merged correctly', async () => {
  const coverageJson = JSON.parse(readFileSync('./coverage/coverage-final.json', 'utf-8'))
  const coverageMap = libCoverage.createCoverageMap(coverageJson)
  const fileCoverage = coverageMap.fileCoverageFor(resolve('./space-multi-transform/src/multi-transform.ts'))
  const lineCoverage = fileCoverage.getLineCoverage()

  // Condition not covered by any test
  expect(lineCoverage[13]).toBe(0)

  // Condition covered by Project #1 but not by Project #2
  expect(lineCoverage[18]).toBe(1)

  // Condition not covered by any test
  expect(lineCoverage[22]).toBe(0)

  // Condition covered by Project #2 but not by Project #1
  expect(lineCoverage[26]).toBe(1)

  // Condition covered by both tests
  expect(lineCoverage[30]).toBe(2)
})
