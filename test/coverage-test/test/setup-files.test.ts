import { resolve } from 'node:path'
import { expect } from 'vitest'
import { isV8Provider, readCoverageMap, runVitest, test } from '../utils'

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

  if (isV8Provider()) {
    expect(fileCoverage).toMatchInlineSnapshot(`
      {
        "branches": "1/1 (100%)",
        "functions": "1/4 (25%)",
        "lines": "6/12 (50%)",
        "statements": "6/12 (50%)",
      }
    `)
  }
  else {
    expect(fileCoverage).toMatchInlineSnapshot(`
      {
        "branches": "0/0 (100%)",
        "functions": "1/4 (25%)",
        "lines": "1/4 (25%)",
        "statements": "1/4 (25%)",
      }
    `)
  }
})
