import { beforeAll, expect } from 'vitest'
import { add } from '../fixtures/src/empty-lines'
import { coverageTest, describe, normalizeURL, readCoverageMap, runVitest, test } from '../utils'

type CoveredLine = 1
type UncoveredLine = 0
type IgnoredLine = undefined

// Key is 1-based line number
type LineCoverage = Record<number, CoveredLine | UncoveredLine | IgnoredLine>

describe('include empty lines', () => {
  let coveredFileLines: LineCoverage
  let uncoveredFileLines: LineCoverage

  beforeAll(async () => {
    await runVitest({
      include: [normalizeURL(import.meta.url)],
      coverage: {
        reporter: 'json',
        ignoreEmptyLines: false,
        include: [
          '**/fixtures/src/empty-lines.ts',
          '**/fixtures/src/untested-file.ts',
          '**/fixtures/src/types-only.ts',
        ],
      },
    })

    ;({ coveredFileLines, uncoveredFileLines } = await readCoverage())
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
})

describe('ignore empty lines', () => {
  let coveredFileLines: LineCoverage
  let uncoveredFileLines: LineCoverage
  let typesOnlyFileLines: LineCoverage

  beforeAll(async () => {
    await runVitest({
      include: [normalizeURL(import.meta.url)],
      coverage: {
        reporter: 'json',
        include: [
          '**/fixtures/src/empty-lines.ts',
          '**/fixtures/src/untested-file.ts',
          '**/fixtures/src/types-only.ts',
        ],
      },
    })

    ;({ coveredFileLines, uncoveredFileLines, typesOnlyFileLines } = await readCoverage())
  })

  test('file containing only types has no uncovered lines', () => {
    expect(typesOnlyFileLines[1]).toBe(undefined)
    expect(typesOnlyFileLines[2]).toBe(undefined)
    expect(typesOnlyFileLines[3]).toBe(undefined)
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
})

coverageTest('cover some lines', () => {
  expect(add(10, 20)).toBe(30)
})

async function readCoverage() {
  const coverageMap = await readCoverageMap()

  const coveredFileLines = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/empty-lines.ts').getLineCoverage() as LineCoverage
  const uncoveredFileLines = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/untested-file.ts').getLineCoverage() as LineCoverage
  const typesOnlyFileLines = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/types-only.ts').getLineCoverage() as LineCoverage

  return { coveredFileLines, uncoveredFileLines, typesOnlyFileLines }
}

function range(count: number, options: { base: number } = { base: 1 }) {
  return Array.from({ length: count }).fill(0).map((_, i) => options.base + i)
}
