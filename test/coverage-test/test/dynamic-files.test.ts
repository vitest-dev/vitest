import { expect } from 'vitest'
import { runDynamicFileCJS, runDynamicFileESM } from '../fixtures/src/dynamic-files'
import { coverageTest, isV8Provider, normalizeURL, readCoverageMap, runVitest, test } from '../utils'

test('does not crash when files are created and removed during test run (#3657)', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: { reporter: 'json' },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toContain('<process-cwd>/fixtures/src/dynamic-files.ts')
  expect(files).toContain('<process-cwd>/fixtures/src/dynamic-file-esm.ignore.js')

  // V8 provider is able to capture CJS as well as it's detected on runtime.
  // Istanbul requires the file to be either processed by Vite, or be present on file system when coverage.all kicks in
  if (isV8Provider()) {
    expect(files).toContain('<process-cwd>/fixtures/src/dynamic-file-cjs.ignore.cjs')
  }
})

coverageTest('run dynamic ESM file', async () => {
  await expect(runDynamicFileESM()).resolves.toBe('Done')
})

coverageTest('run dynamic CJS file', async () => {
  await expect(runDynamicFileCJS()).resolves.toBe('Done')
})
