import libCoverage from 'istanbul-lib-coverage'
import { expect } from 'vitest'
import { isBrowser, isV8Provider, readCoverageJson, runVitest, test } from '../utils'

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
  const files = coverageMap.files()

  expect(files).toContain('<process-cwd>/fixtures/src/pre-transpiled/original.ts')
  expect(files.find(file => file.includes('transpiled.js'))).toBeFalsy()
  expect(files.find(file => file.includes('transpiled.js.map'))).toBeFalsy()
  expect(files.find(file => file.includes('transpiled.ts'))).toBeFalsy()
  expect(files.find(file => file.includes('transpiled.d.ts'))).toBeFalsy()

  if (isV8Provider()) {
    if (isBrowser()) {
      expect(coverageMap).toMatchInlineSnapshot(`
        {
          "branches": "2/4 (50%)",
          "functions": "2/2 (100%)",
          "lines": "11/17 (64.7%)",
          "statements": "11/17 (64.7%)",
        }
      `)
    }
    else {
      expect(coverageMap).toMatchInlineSnapshot(`
        {
          "branches": "2/4 (50%)",
          "functions": "2/2 (100%)",
          "lines": "9/13 (69.23%)",
          "statements": "9/13 (69.23%)",
        }
      `)
    }
  }
  else {
    expect(coverageMap).toMatchInlineSnapshot(`
      {
        "branches": "3/6 (50%)",
        "functions": "2/2 (100%)",
        "lines": "6/8 (75%)",
        "statements": "6/8 (75%)",
      }
    `)
  }

  await expect(JSON.stringify(coverageJson, null, 2)).toMatchFileSnapshot(
    `__snapshots__/pre-transpiled-${
      isV8Provider() ? (isBrowser() ? 'v8-browser' : 'v8') : 'istanbul'
    }.snapshot.json`,
  )
})
