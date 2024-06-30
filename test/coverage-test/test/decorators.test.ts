import { expect } from 'vitest'
import { coverageTest, isV8Provider, normalizeURL, readCoverageMap, runVitest, test } from '../utils'
import { DecoratorsTester } from '../fixtures/src/decorators'

test('decorators generated metadata is ignored', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    config: 'fixtures/configs/vitest.config.decorators.ts',
    coverage: { reporter: 'json', all: false },
  })

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/decorators.ts')
  const lineCoverage = fileCoverage.getLineCoverage()
  const branchCoverage = fileCoverage.getBranchCoverageByLine()

  // Decorator should not be uncovered - on V8 this is marked as covered, on Istanbul it's excluded from report
  if (isV8Provider()) {
    expect(lineCoverage['4']).toBe(1)
    expect(branchCoverage['4'].coverage).toBe(100)
  }
  else {
    expect(lineCoverage['4']).toBeUndefined()
    expect(branchCoverage['4']).toBeUndefined()
  }

  // Covered branch should be marked correctly
  expect(lineCoverage['7']).toBe(1)

  // Uncovered branch should be marked correctly
  expect(lineCoverage['12']).toBe(0)
})

coverageTest('cover decorators', () => {
  new DecoratorsTester().method('cover line')
})
