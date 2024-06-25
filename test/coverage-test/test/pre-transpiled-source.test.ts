import libCoverage from 'istanbul-lib-coverage'
import { expect } from 'vitest'
import { coverageTest, isV8Provider, normalizeURL, readCoverageJson, runVitest, test } from '../utils'
import * as transpiled from '../fixtures/src/pre-transpiled/transpiled.js'

test('pre-transpiled code with source maps to original (#5341)', async () => {
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
  const files = coverageMap.files()

  expect(files).toContain('<process-cwd>/fixtures/src/pre-transpiled/original.ts')
  expect(files.find(file => file.includes('transpiled.js'))).toBeFalsy()
  expect(files.find(file => file.includes('transpiled.js.map'))).toBeFalsy()
  expect(files.find(file => file.includes('transpiled.ts'))).toBeFalsy()
  expect(files.find(file => file.includes('transpiled.d.ts'))).toBeFalsy()

  expect(JSON.stringify(coverageJson, null, 2)).toMatchFileSnapshot(`__snapshots__/pre-transpiled-${isV8Provider() ? 'v8' : 'istanbul'}.snapshot.json`)
})

coverageTest('run pre-transpiled sources', () => {
  expect(transpiled.hello).toBeTypeOf('function')
  expect(transpiled.hello()).toBeUndefined()
})
