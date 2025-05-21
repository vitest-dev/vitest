import { expect } from 'vitest'
import { isV8Provider, readCoverageMap, runVitest, test } from '../utils'

test('in-source tests work', async () => {
  const { stdout } = await runVitest({
    include: [],
    includeSource: ['fixtures/src/in-source.ts'],
    coverage: { all: false, reporter: 'json' },
  })

  expect(stdout).toContain('in source test running add function')

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/in-source.ts",
    ]
  `)

  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/in-source.ts')

  // If-branch is not taken - makes sure source maps are correct in in-source testing too
  expect(fileCoverage.getUncoveredLines()).toContain('5')

  if (isV8Provider()) {
    expect(fileCoverage).toMatchInlineSnapshot(`
      {
        "branches": "2/4 (50%)",
        "functions": "1/1 (100%)",
        "lines": "10/12 (83.33%)",
        "statements": "10/12 (83.33%)",
      }
    `)
  }
  else {
    expect(fileCoverage).toMatchInlineSnapshot(`
      {
        "branches": "3/6 (50%)",
        "functions": "2/2 (100%)",
        "lines": "6/7 (85.71%)",
        "statements": "6/7 (85.71%)",
      }
    `)
  }
})
