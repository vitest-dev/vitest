import { expect, vi } from 'vitest'
import { rolldownVersion } from 'vitest/node'
import { DecoratorsTester } from '../fixtures/src/decorators'
import { coverageTest, normalizeURL, readCoverageMap, runVitest, test } from '../utils'

test('decorators generated metadata is ignored', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    config: 'fixtures/configs/vitest.config.decorators.ts',
    coverage: { reporter: 'json' },
  })

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/decorators.ts')
  const lineCoverage = fileCoverage.getLineCoverage()
  const branchCoverage = fileCoverage.getBranchCoverageByLine()

  expect.soft(lineCoverage['4']).toBeUndefined()
  expect.soft(branchCoverage['4']).toBeUndefined()

  // Covered branch should be marked correctly
  expect.soft(lineCoverage['7']).toBe(1)

  // Uncovered branch should be marked correctly
  expect.soft(lineCoverage['12']).toBe(0)
})

test('decorators generated metadata is covered with OXC decorators', async ({ onTestFinished }) => {
  if (!rolldownVersion) {
    return
  }

  vi.stubEnv('TEST_OXC_DECORATOR', 'true')
  onTestFinished(() => {
    vi.unstubAllEnvs()
  })

  await runVitest({
    include: [normalizeURL(import.meta.url)],
    config: 'fixtures/configs/vitest.config.decorators.ts',
    coverage: { reporter: ['json', 'html'] },
  })

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/decorators.ts')
  const lineCoverage = fileCoverage.getLineCoverage()
  const branchCoverage = fileCoverage.getBranchCoverageByLine()

  expect.soft(lineCoverage['4']).toBe(1) // this is different from SWC case above
  expect.soft(branchCoverage['4']).toBeUndefined()

  // Covered branch should be marked correctly
  expect.soft(lineCoverage['7']).toBe(1)

  // Uncovered branch should be marked correctly
  expect.soft(lineCoverage['12']).toBe(0)
})

coverageTest('cover decorators', () => {
  new DecoratorsTester().method('cover line')
})
