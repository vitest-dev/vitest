import { expect } from 'vitest'
import { isV8Provider, readCoverageMap, runVitest, test } from '../utils'

test('filter out functions injected by plugin', async () => {
  const { stderr } = await runVitest({
    include: ['fixtures/test/injected-functions.test.ts'],
    coverage: {
      reporter: ['json', 'html'],
      include: ['fixtures/src/injected-functions.ts'],
    },
    config: 'fixtures/configs/vitest.config.injected-functions.ts',
  })
  expect(stderr).toBe('')

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/injected-functions.ts')
  if (isV8Provider()) {
    expect(fileCoverage.fnMap).toMatchInlineSnapshot(`
      {
        "0": {
          "decl": {
            "end": {
              "column": 1,
              "line": 3,
            },
            "start": {
              "column": 0,
              "line": 1,
            },
          },
          "line": 1,
          "loc": {
            "end": {
              "column": 1,
              "line": 3,
            },
            "start": {
              "column": 0,
              "line": 1,
            },
          },
          "name": "original",
        },
      }
    `)
    expect(fileCoverage.f).toMatchInlineSnapshot(`
      {
        "0": 1,
      }
    `)
  }
  else {
    expect(fileCoverage.fnMap).toMatchInlineSnapshot(`
      {
        "0": {
          "decl": {
            "end": {
              "column": 9,
              "line": 1,
            },
            "start": {
              "column": 0,
              "line": 1,
            },
          },
          "loc": {
            "end": {
              "column": 9,
              "line": 1,
            },
            "start": {
              "column": 0,
              "line": 1,
            },
          },
          "name": "prepended",
        },
        "1": {
          "decl": {
            "end": {
              "column": 20,
              "line": 1,
            },
            "start": {
              "column": 9,
              "line": 1,
            },
          },
          "loc": {
            "end": {
              "column": null,
              "line": 3,
            },
            "start": {
              "column": 20,
              "line": 1,
            },
          },
          "name": "original",
        },
      }
    `)
    expect(fileCoverage.f).toMatchInlineSnapshot(`
      {
        "0": 0,
        "1": 1,
      }
    `)
  }
})
