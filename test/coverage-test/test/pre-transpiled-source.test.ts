import libCoverage from 'istanbul-lib-coverage'
import { expect } from 'vitest'
import { isV8Provider, readCoverageJson, runVitest, test } from '../utils'

test('pre-transpiled code with source maps to original (#5341)', async () => {
  await runVitest({
    include: ['fixtures/test/pre-transpiled-fixture.test.ts'],
    coverage: {
      include: ['fixtures/src/**'],
      reporter: 'json',
      all: false,
    },
  })

  const coverageJson = await readCoverageJson()
  const coverageMap = libCoverage.createCoverageMap(coverageJson)

  // transpiled.ts/transpiled.js should not be included
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/pre-transpiled/original.ts",
    ]
  `)

  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/pre-transpiled/original.ts')

  if (isV8Provider()) {
    expect(fileCoverage).toMatchInlineSnapshot(`
      {
        "branches": "2/4 (50%)",
        "functions": "2/2 (100%)",
        "lines": "11/17 (64.7%)",
        "statements": "11/17 (64.7%)",
      }
    `)
  }
  else {
    expect(fileCoverage).toMatchInlineSnapshot(`
      {
        "branches": "3/6 (50%)",
        "functions": "2/2 (100%)",
        "lines": "6/8 (75%)",
        "statements": "6/8 (75%)",
      }
    `)
  }
})
