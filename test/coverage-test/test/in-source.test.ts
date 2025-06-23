import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('in-source tests work', async () => {
  const { stdout } = await runVitest({
    include: [],
    includeSource: ['fixtures/src/in-source.ts'],
    coverage: { reporter: 'json' },
  })

  expect(stdout).toContain('in source test running add function')

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/in-source.ts",
    ]
  `)

  const fileCoverage = coverageMap.fileCoverageFor(files[0])
  const functions = Object.values(fileCoverage.fnMap).map(fn => fn.name)

  // If-branch is not taken - makes sure source maps are correct in in-source testing too
  expect(fileCoverage.getUncoveredLines()).toContain('5')

  expect(fileCoverage).toMatchInlineSnapshot(`
    {
      "branches": "2/4 (50%)",
      "functions": "1/1 (100%)",
      "lines": "2/3 (66.66%)",
      "statements": "2/3 (66.66%)",
    }
  `)

  // The "customNamedTestFunction" should be excluded by auto-generated ignore hints
  expect(functions).toMatchInlineSnapshot(`
    [
      "add",
    ]
  `)
})
