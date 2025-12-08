/*
 * Ignore hints are implemented by 3rd party packages but there's
 * Vitest related logic (esbuild) that makes them work.
*/

import { expect } from 'vitest'
import { isV8Provider, readCoverageMap, runVitest, test } from '../utils'

test('ignore hints work', async () => {
  await runVitest({
    include: ['fixtures/test/ignore-hints-fixture.test.ts'],
    coverage: { reporter: 'json' },
  })

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/ignore-hints.ts')
  const lines = fileCoverage.getLineCoverage()

  // Covered
  expect(lines[8]).toBeGreaterThanOrEqual(1)
  expect(lines[22]).toBeGreaterThanOrEqual(1)
  expect(lines[30]).toBeGreaterThanOrEqual(1)

  // Ignored start+end lines
  expect(lines[11]).toBeUndefined()
  expect(lines[12]).toBeUndefined()
  expect(lines[13]).toBeUndefined()
  expect(lines[14]).toBeUndefined()
  expect(lines[15]).toBeUndefined()
  expect(lines[16]).toBeUndefined()
  expect(lines[17]).toBeUndefined()
  expect(lines[18]).toBeUndefined()
  expect(lines[19]).toBeUndefined()

  // Ignore istanbul
  expect(lines[28]).toBeUndefined()

  // Line 25 = Ignore v8
  if (isV8Provider()) {
    expect(lines[25]).toBeUndefined()
  }
  else {
    expect(lines[25]).toBeGreaterThanOrEqual(1)
  }
})
