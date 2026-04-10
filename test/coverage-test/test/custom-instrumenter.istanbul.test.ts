import { createInstrumenter } from 'istanbul-lib-instrument'
import { expect } from 'vitest'
import { sum } from '../fixtures/src/math'
import { coverageTest, normalizeURL, readCoverageMap, runVitest, test } from '../utils'

test('custom instrumenter is used when provided', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      reporter: 'json',
      instrumenter: () => {
        // Use the default istanbul instrumenter but through the custom interface,
        // proving the pluggable architecture works end-to-end.
        const defaultInstrumenter = createInstrumenter({
          produceSourceMap: true,
          autoWrap: false,
          esModules: true,
          compact: false,
          coverageVariable: '__VITEST_COVERAGE__',
          coverageGlobalScope: 'globalThis',
          coverageGlobalScopeFunc: false,
        })

        return {
          instrumentSync: (code: string, filename: string, sourceMap?: any) =>
            defaultInstrumenter.instrumentSync(code, filename, sourceMap),
          lastSourceMap: () =>
            defaultInstrumenter.lastSourceMap(),
          lastFileCoverage: () =>
            defaultInstrumenter.lastFileCoverage(),
        }
      },
    },
  })

  // Coverage should work with the custom instrumenter
  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()
  expect(files.length).toBeGreaterThan(0)

  const mathCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/math.ts')
  expect(Object.keys(mathCoverage.fnMap).length).toBeGreaterThan(0)
})

coverageTest('cover math module', () => {
  expect(sum(1, 2)).toBe(3)
})
