import libCoverage from 'istanbul-lib-coverage'
import { expect } from 'vitest'
import * as transpiled from '../fixtures/src/pre-bundle/bundle.js'
import { coverageTest, formatSummary, isV8Provider, normalizeURL, readCoverageJson, runVitest, test } from '../utils.js'

test('bundled code with source maps to originals', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: ['fixtures/src/**'],
      reporter: 'json',
      all: false,
    },
  })

  const coverageJson = await readCoverageJson()
  const coverageMap = libCoverage.createCoverageMap(coverageJson)

  // bundle.ts/bundle.js should not be included
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/pre-bundle/first.ts",
      "<process-cwd>/fixtures/src/pre-bundle/second.ts",
    ]
  `)

  const first = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/pre-bundle/first.ts')
  const second = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/pre-bundle/second.ts')

  const summary = {
    [first.path]: formatSummary(first.toSummary()),
    [second.path]: formatSummary(second.toSummary()),
  }

  if (isV8Provider()) {
    expect(summary).toMatchInlineSnapshot(`
      {
        "<process-cwd>/fixtures/src/pre-bundle/first.ts": {
          "branches": "1/1 (100%)",
          "functions": "1/2 (50%)",
          "lines": "4/6 (66.66%)",
          "statements": "4/6 (66.66%)",
        },
        "<process-cwd>/fixtures/src/pre-bundle/second.ts": {
          "branches": "1/1 (100%)",
          "functions": "1/2 (50%)",
          "lines": "4/6 (66.66%)",
          "statements": "4/6 (66.66%)",
        },
      }
    `)
  }
  else {
    expect(summary).toMatchInlineSnapshot(`
      {
        "<process-cwd>/fixtures/src/pre-bundle/first.ts": {
          "branches": "0/0 (100%)",
          "functions": "1/2 (50%)",
          "lines": "1/2 (50%)",
          "statements": "1/2 (50%)",
        },
        "<process-cwd>/fixtures/src/pre-bundle/second.ts": {
          "branches": "0/0 (100%)",
          "functions": "1/2 (50%)",
          "lines": "1/2 (50%)",
          "statements": "1/2 (50%)",
        },
      }
    `)
  }
})

coverageTest('run bundled sources', () => {
  expect(transpiled.first.covered).toBeTypeOf('function')
  expect(transpiled.first.covered()).toBe('First')

  expect(transpiled.second.covered).toBeTypeOf('function')
  expect(transpiled.second.covered()).toBe('Second')
})
