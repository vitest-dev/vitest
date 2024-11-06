import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, expect } from 'vitest'
import { isBrowser, isV8Provider, readCoverageMap, runVitest, test } from '../utils'

beforeAll(async () => {
  await runVitest({
    include: ['fixtures/test/vue-fixture.test.ts'],
    coverage: { reporter: ['json', 'html'], all: false },
  })
})

test('files should not contain query parameters', () => {
  const coveragePath = resolve('./coverage/Vue/Counter/')
  const files = readdirSync(coveragePath)

  expect(files).toContain('index.html')
  expect(files).toContain('Counter.vue.html')
  expect(files).toContain('Counter.component.ts.html')
  expect(files).not.toContain('Counter.component.ts?vue&type=script&src=true&lang.ts.html')
})

test('coverage results matches snapshot', async () => {
  const coverageMap = await readCoverageMap()
  const summary = coverageMap.getCoverageSummary()

  if (isV8Provider()) {
    const { branches, functions, lines, statements } = summary

    expect({ branches, functions }).toMatchInlineSnapshot(`
      {
        "branches": {
          "covered": 5,
          "pct": 83.33,
          "skipped": 0,
          "total": 6,
        },
        "functions": {
          "covered": 3,
          "pct": 60,
          "skipped": 0,
          "total": 5,
        },
      }
    `)

    // Lines and statements are not 100% identical between node and browser - not sure if it's Vue, Vite or Vitest issue
    if (isBrowser()) {
      expect({ lines, statements }).toMatchInlineSnapshot(`
        {
          "lines": {
            "covered": 40,
            "pct": 83.33,
            "skipped": 0,
            "total": 48,
          },
          "statements": {
            "covered": 40,
            "pct": 83.33,
            "skipped": 0,
            "total": 48,
          },
        }
      `)
    }
    else {
      expect({ lines, statements }).toMatchInlineSnapshot(`
        {
          "lines": {
            "covered": 35,
            "pct": 81.39,
            "skipped": 0,
            "total": 43,
          },
          "statements": {
            "covered": 35,
            "pct": 81.39,
            "skipped": 0,
            "total": 43,
          },
        }
      `)
    }
  }
  else {
    expect(summary).toMatchInlineSnapshot(`
      {
        "branches": {
          "covered": 5,
          "pct": 83.33,
          "skipped": 0,
          "total": 6,
        },
        "branchesTrue": {
          "covered": 0,
          "pct": "Unknown",
          "skipped": 0,
          "total": 0,
        },
        "functions": {
          "covered": 5,
          "pct": 71.42,
          "skipped": 0,
          "total": 7,
        },
        "lines": {
          "covered": 13,
          "pct": 81.25,
          "skipped": 0,
          "total": 16,
        },
        "statements": {
          "covered": 14,
          "pct": 82.35,
          "skipped": 0,
          "total": 17,
        },
      }
    `)
  }
})
