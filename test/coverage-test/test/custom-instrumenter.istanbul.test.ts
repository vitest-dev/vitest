import { expect, vi } from 'vitest'
import { normalizeURL, runVitest, test } from '../utils'

test('custom instrumenter receives correct options', async () => {
  const instrumenter = vi.fn().mockReturnValue({
    instrumentSync: code => code,
    lastSourceMap: () => ({}),
    lastFileCoverage: () => ({
      path: 'test.ts',
      statementMap: {},
      fnMap: {},
      branchMap: {},
      s: {},
      f: {},
      b: {},
    }),
  })

  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      reporter: 'json',
      ignoreClassMethods: ['test-method'],
      instrumenter,
    },
  }, { throwOnError: false })

  expect(instrumenter).toHaveBeenCalledWith({
    coverageVariable: '__VITEST_COVERAGE__',
    coverageGlobalScope: 'globalThis',
    coverageGlobalScopeFunc: false,
    ignoreClassMethods: ['test-method'],
  })
})
