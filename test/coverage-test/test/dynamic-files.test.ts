import { expect } from 'vitest'
import { runDynamicFileCJS, runDynamicFileESM } from '../fixtures/src/dynamic-files'
import { coverageTest, normalizeURL, readCoverageMap, runVitest, test } from '../utils'

test('does not crash when files are created and removed during test run (#3657)', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: { reporter: 'json' },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toContain('<process-cwd>/fixtures/src/dynamic-files.ts')
})

coverageTest('run dynamic ESM file', async () => {
  await expect(runDynamicFileESM()).resolves.toBe('Done')
})

coverageTest('run dynamic CJS file', async () => {
  await expect(runDynamicFileCJS()).resolves.toBe('Done')
})
