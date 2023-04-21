import { existsSync, readFileSync } from 'node:fs'
import { normalize } from 'node:path'
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
  const fileCoverage = coverageMap.fileCoverageFor(normalize(resolve('./src/math.ts')))

  // There should be 1 uncovered branch and 1 uncovered function. See math.ts.
  expect(fileCoverage.toSummary()).toMatchInlineSnapshot(`
    {
      "branches": {
        "covered": 3,
        "pct": 75,
        "skipped": 0,
        "total": 4,
      },
      "functions": {
        "covered": 2,
        "pct": 66.66,
        "skipped": 0,
        "total": 3,
      },
      "lines": {
        "covered": 7,
        "pct": 50,
        "skipped": 0,
        "total": 14,
      },
      "statements": {
        "covered": 7,
        "pct": 50,
        "skipped": 0,
        "total": 14,
      },
    }
  `)
})
