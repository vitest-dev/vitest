import { beforeAll, expect, test } from 'vitest'
import libCoverage from 'istanbul-lib-coverage'

import { readCoverageJson } from './utils'

// Key is 1-based line number
type LineCoverage = Record<number, number>

let coveredFileLines: LineCoverage
let uncoveredFileLines: LineCoverage

beforeAll(async () => {
  const coverageJson = await readCoverageJson('./coverage/coverage-final.json')
  const coverageMap = libCoverage.createCoverageMap(coverageJson as any)

  coveredFileLines = coverageMap.fileCoverageFor('<process-cwd>/src/empty-lines.ts').getLineCoverage() as typeof coveredFileLines
  uncoveredFileLines = coverageMap.fileCoverageFor('<process-cwd>/src/untested-file.ts').getLineCoverage() as typeof uncoveredFileLines
})

test('lines are included', async () => {
  for (const line of range(29)) {
    expect(coveredFileLines[line], `Line #${line}`).not.toBe(undefined)
    expect(coveredFileLines[line], `Line #${line}`).toBeTypeOf('number')
  }

  for (const lines of [range(37), range(4, { base: 44 })]) {
    for (const line of lines) {
      expect(uncoveredFileLines[line], `Line #${line}`).not.toBe(undefined)
      expect(uncoveredFileLines[line], `Line #${line}`).toBeTypeOf('number')
    }
  }
})

test('lines with ignore hints are ignored', () => {
  for (const line of range(6, { base: 38 })) {
    expect(uncoveredFileLines[line], `Line #${line}`).toBe(undefined)
  }
})

function range(count: number, options: { base: number } = { base: 1 }) {
  return Array(count).fill(0).map((_, i) => options.base + i)
}
