import { createRequire } from 'node:module'
import { expect } from 'vitest'
import { coverageTest, isV8Provider, normalizeURL, readCoverageMap, runVitest, test } from '../utils'

test('does not crash when file outside Vite is loaded (#5639)', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: { reporter: 'json' },
  })

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/load-outside-vite.cjs')
  const summary = fileCoverage.toSummary()

  if (isV8Provider()) {
    expect(summary).toMatchInlineSnapshot(`
      {
        "branches": {
          "covered": 0,
          "pct": 100,
          "skipped": 0,
          "total": 0,
        },
        "functions": {
          "covered": 0,
          "pct": 0,
          "skipped": 0,
          "total": 1,
        },
        "lines": {
          "covered": 1,
          "pct": 100,
          "skipped": 0,
          "total": 1,
        },
        "statements": {
          "covered": 1,
          "pct": 100,
          "skipped": 0,
          "total": 1,
        },
      }
    `)
  }
  else {
    expect(summary).toMatchInlineSnapshot(`
      {
        "branches": {
          "covered": 0,
          "pct": 100,
          "skipped": 0,
          "total": 0,
        },
        "functions": {
          "covered": 0,
          "pct": 0,
          "skipped": 0,
          "total": 1,
        },
        "lines": {
          "covered": 0,
          "pct": 0,
          "skipped": 0,
          "total": 1,
        },
        "statements": {
          "covered": 0,
          "pct": 0,
          "skipped": 0,
          "total": 1,
        },
      }
    `)
  }
})

coverageTest('load file using require so it\'s not intercepted by Vite', () => {
  const noop = createRequire(import.meta.url)('../fixtures/src/load-outside-vite.cjs')

  expect(noop).toBeTypeOf('function')
})
