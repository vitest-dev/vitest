import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('{ all: true } includes uncovered files', async () => {
  await runVitest({
    include: ['fixtures/test/multi-environment-fixture-**'],
    config: 'fixtures/configs/vitest.config.multi-transform.ts',
    coverage: { all: false, reporter: 'json' },
  })

  const coverageMap = await readCoverageMap()

  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/multi-environment.ts')
  const lineCoverage = fileCoverage.getLineCoverage()

  // Condition not covered by any test
  expect(lineCoverage[13]).toBe(0)

  // Condition covered by SSR test but not by Web
  expect(lineCoverage[18]).toBe(1)

  // Condition not covered by any test
  expect(lineCoverage[22]).toBe(0)

  // Condition covered by Web test but not by SSR
  expect(lineCoverage[26]).toBe(1)

  // Condition covered by both tests
  expect(lineCoverage[30]).toBe(2)
})
