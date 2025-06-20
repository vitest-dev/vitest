import { expect } from 'vitest'
import { useImportEnv } from '../fixtures/src/import-meta-env'
import { coverageTest, normalizeURL, readCoverageMap, runVitest, test } from '../utils'

test('file using import.meta.env is included in report (#2332)', async () => {
  await runVitest(
    {
      include: [normalizeURL(import.meta.url)],
      coverage: { reporter: 'json' },
      env: { SOME_VARIABLE: 'some variable set here' },
    },
  )

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/import-meta-env.ts')
  const lines = fileCoverage.getLineCoverage()

  expect(lines[3]).toBe(1)
})

coverageTest('cover file that uses import.meta.env', () => {
  expect(useImportEnv()).toBe('some variable set here')
})
