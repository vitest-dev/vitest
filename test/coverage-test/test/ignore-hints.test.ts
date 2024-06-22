/*
 * Ignore hints are implemented by 3rd party packages but there's
 * Vitest related logic (esbuild) that makes them work.
*/

import { expect } from 'vitest'
import { isV8Provider, readCoverageMap, runVitest, test } from '../utils'

test('ignore hints work', async () => {
  await runVitest({
    include: ['fixtures/test/ignore-hints-fixture.test.ts'],
    coverage: { reporter: 'json', all: false },
  })

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/ignore-hints.ts')
  const lines = fileCoverage.getLineCoverage()

  expect(lines[8]).toBeGreaterThanOrEqual(1)
  expect(lines[12]).toBeGreaterThanOrEqual(1)

  if (isV8Provider()) {
    expect(lines[15]).toBeUndefined()
    expect(lines[18]).toBeGreaterThanOrEqual(1)
  }
  else {
    expect(lines[15]).toBeGreaterThanOrEqual(1)
    expect(lines[18]).toBeUndefined()
  }
})
