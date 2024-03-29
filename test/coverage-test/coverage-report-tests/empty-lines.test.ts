import { beforeAll, expect, test } from 'vitest'
import libCoverage from 'istanbul-lib-coverage'

import { readCoverageJson } from './utils'

type CoveredLine = 1
type UncoveredLine = 0
type IgnoredLine = undefined

// Key is 1-based line number
type LineCoverage = Record<number, CoveredLine | UncoveredLine | IgnoredLine>

let coveredFileLines: LineCoverage
let uncoveredFileLines: LineCoverage

beforeAll(async () => {
  const coverageJson = await readCoverageJson('./coverage/coverage-final.json')
  const coverageMap = libCoverage.createCoverageMap(coverageJson as any)

  coveredFileLines = coverageMap.fileCoverageFor('<process-cwd>/src/empty-lines.ts').getLineCoverage() as typeof coveredFileLines
  uncoveredFileLines = coverageMap.fileCoverageFor('<process-cwd>/src/untested-file.ts').getLineCoverage() as typeof uncoveredFileLines
})

test('empty lines are ignored', async () => {
  expect(coveredFileLines[12]).toBe(undefined)
  expect(coveredFileLines[14]).toBe(undefined)
  expect(coveredFileLines[19]).toBe(undefined)
  expect(coveredFileLines[27]).toBe(undefined)
  expect(coveredFileLines[30]).toBe(undefined)

  expect(uncoveredFileLines[5]).toBe(undefined)
  expect(uncoveredFileLines[7]).toBe(undefined)
})

test('comments are ignored', async () => {
  expect(coveredFileLines[1]).toBe(undefined)
  expect(coveredFileLines[3]).toBe(undefined)
  expect(coveredFileLines[4]).toBe(undefined)
  expect(coveredFileLines[5]).toBe(undefined)
  expect(coveredFileLines[6]).toBe(undefined)
  expect(coveredFileLines[7]).toBe(undefined)
  expect(coveredFileLines[9]).toBe(undefined)
  expect(coveredFileLines[16]).toBe(undefined)

  expect(uncoveredFileLines[1]).toBe(undefined)
  expect(uncoveredFileLines[2]).toBe(undefined)
  expect(uncoveredFileLines[3]).toBe(undefined)
  expect(uncoveredFileLines[4]).toBe(undefined)
  expect(uncoveredFileLines[6]).toBe(undefined)
  expect(uncoveredFileLines[13]).toBe(undefined)
  expect(uncoveredFileLines[20]).toBe(undefined)
  expect(uncoveredFileLines[34]).toBe(undefined)
  expect(uncoveredFileLines[45]).toBe(undefined)
})

test('ignore hints are ignored', () => {
  expect(uncoveredFileLines[38]).toBe(undefined)
  expect(uncoveredFileLines[39]).toBe(undefined)
  expect(uncoveredFileLines[40]).toBe(undefined)
  expect(uncoveredFileLines[41]).toBe(undefined)
  expect(uncoveredFileLines[42]).toBe(undefined)
  expect(uncoveredFileLines[43]).toBe(undefined)
})

test('typescript types are ignored', () => {
  expect(coveredFileLines[13]).toBe(undefined)
  expect(coveredFileLines[20]).toBe(undefined)
  expect(coveredFileLines[21]).toBe(undefined)
  expect(coveredFileLines[22]).toBe(undefined)
  expect(coveredFileLines[23]).toBe(undefined)
  expect(coveredFileLines[24]).toBe(undefined)
  expect(coveredFileLines[25]).toBe(undefined)
  expect(coveredFileLines[26]).toBe(undefined)

  expect(uncoveredFileLines[17]).toBe(undefined)
  expect(uncoveredFileLines[25]).toBe(undefined)
  expect(uncoveredFileLines[26]).toBe(undefined)
  expect(uncoveredFileLines[27]).toBe(undefined)
  expect(uncoveredFileLines[28]).toBe(undefined)
  expect(uncoveredFileLines[29]).toBe(undefined)
  expect(uncoveredFileLines[30]).toBe(undefined)
  expect(uncoveredFileLines[31]).toBe(undefined)
})

test('runtime code is not ignored', () => {
  // Covered
  expect(coveredFileLines[2]).toBe(1)
  expect(coveredFileLines[8]).toBe(1)
  expect(coveredFileLines[15]).toBe(1)
  expect(coveredFileLines[28]).toBe(1)

  // Uncovered
  expect(coveredFileLines[10]).toBe(0)
  expect(coveredFileLines[17]).toBe(0)

  // Uncovered
  expect(uncoveredFileLines[8]).toBe(0)
  expect(uncoveredFileLines[9]).toBe(0)
  expect(uncoveredFileLines[10]).toBe(0)
  expect(uncoveredFileLines[12]).toBe(0)
  expect(uncoveredFileLines[14]).toBe(0)
  expect(uncoveredFileLines[19]).toBe(0)
  expect(uncoveredFileLines[21]).toBe(0)
  expect(uncoveredFileLines[24]).toBe(0)
  expect(uncoveredFileLines[33]).toBe(0)
  expect(uncoveredFileLines[35]).toBe(0)
  expect(uncoveredFileLines[46]).toBe(0)
})
