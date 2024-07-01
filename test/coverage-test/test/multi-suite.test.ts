import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('tests with multiple suites are covered (#3514)', async () => {
  await runVitest({
    include: ['fixtures/test/multi-suite-fixture.test.ts'],
    coverage: { reporter: 'json', all: false },
  })

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/multi-suite.ts')

  // Assert that all functions are covered
  expect(fileCoverage.f).toMatchObject({
    0: 1,
    1: 1,
  })
})
