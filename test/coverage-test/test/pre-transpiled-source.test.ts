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
  const files = coverageMap.files()

  expect(files).toContain('<process-cwd>/fixtures/src/pre-transpiled/original.ts')
  expect(files.find(file => file.includes('transpiled.js'))).toBeFalsy()
  expect(files.find(file => file.includes('transpiled.js.map'))).toBeFalsy()
  expect(files.find(file => file.includes('transpiled.ts'))).toBeFalsy()
  expect(files.find(file => file.includes('transpiled.d.ts'))).toBeFalsy()

  await expect(JSON.stringify(coverageJson, null, 2)).toMatchFileSnapshot(`__snapshots__/pre-transpiled-${isV8Provider() ? 'v8' : 'istanbul'}.snapshot.json`)
})
