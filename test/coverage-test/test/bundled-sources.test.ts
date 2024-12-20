import libCoverage from 'istanbul-lib-coverage'
import { expect } from 'vitest'
import * as transpiled from '../fixtures/src/pre-bundle/bundle.js'
import { coverageTest, isV8Provider, normalizeURL, readCoverageJson, runVitest, test } from '../utils.js'

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
  const files = coverageMap.files()

  expect(files).toContain('<process-cwd>/fixtures/src/pre-bundle/first.ts')
  expect(files).toContain('<process-cwd>/fixtures/src/pre-bundle/second.ts')
  expect(files.find(file => file.includes('bundle.js'))).toBeFalsy()
  expect(files.find(file => file.includes('bundle.js.map'))).toBeFalsy()
  expect(files.find(file => file.includes('bundle.ts'))).toBeFalsy()
  expect(files.find(file => file.includes('bundle.d.ts'))).toBeFalsy()

  await expect(JSON.stringify(coverageJson, null, 2)).toMatchFileSnapshot(`__snapshots__/bundled-${isV8Provider() ? 'v8' : 'istanbul'}.snapshot.json`)
})

coverageTest('run bundled sources', () => {
  expect(transpiled.first.covered).toBeTypeOf('function')
  expect(transpiled.first.covered()).toBe('First')

  expect(transpiled.second.covered).toBeTypeOf('function')
  expect(transpiled.second.covered()).toBe('Second')
})
