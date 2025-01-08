import { resolve } from 'node:path'
import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('tests with multiple suites are covered (#3514)', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/test/math.test.ts'],
    setupFiles: [
      // Full absolute path
      resolve('fixtures/setup.ts'),
      // Relative path
      'fixtures/src/another-setup.ts',
    ],
    coverage: {
      include: ['fixtures/**'],
      reporter: 'json',
    },
  })

  // Setup files should have run
  expect(stdout).toContain('Running setup in fixtures root')
  expect(stdout).toContain('Running another setup in fixtures src')

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  // Setup files should be excluded from report
  expect(files.find(file => file.includes('setup.ts'))).toBeFalsy()

  // Some valid coverage should be reported
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/math.ts')
  expect(fileCoverage.toSummary().functions.covered).toBe(1)
  expect(fileCoverage.toSummary().functions.pct).toBeLessThanOrEqual(25)
})
