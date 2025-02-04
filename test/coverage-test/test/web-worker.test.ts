import { expect } from 'vitest'
import { isV8Provider, readCoverageMap, runVitest, test } from '../utils'

test('web worker coverage is correct', async () => {
  await runVitest({
    setupFiles: ['@vitest/web-worker'],
    include: ['fixtures/test/web-worker.ts'],
    environment: 'jsdom',
    coverage: {
      include: ['fixtures/src/worker.ts'],
      reporter: 'json',
    },
  })

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/worker.ts')
  const summary = fileCoverage.toSummary()

  if (isV8Provider()) {
    expect(summary).toMatchInlineSnapshot(`
      {
        "branches": {
          "covered": 3,
          "pct": 60,
          "skipped": 0,
          "total": 5,
        },
        "functions": {
          "covered": 2,
          "pct": 66.66,
          "skipped": 0,
          "total": 3,
        },
        "lines": {
          "covered": 14,
          "pct": 60.86,
          "skipped": 0,
          "total": 23,
        },
        "statements": {
          "covered": 14,
          "pct": 60.86,
          "skipped": 0,
          "total": 23,
        },
      }
    `)
  }
  else {
    expect(summary).toMatchInlineSnapshot(`
      {
        "branches": {
          "covered": 2,
          "pct": 50,
          "skipped": 0,
          "total": 4,
        },
        "functions": {
          "covered": 2,
          "pct": 66.66,
          "skipped": 0,
          "total": 3,
        },
        "lines": {
          "covered": 10,
          "pct": 66.66,
          "skipped": 0,
          "total": 15,
        },
        "statements": {
          "covered": 10,
          "pct": 66.66,
          "skipped": 0,
          "total": 15,
        },
      }
    `)
  }
})
