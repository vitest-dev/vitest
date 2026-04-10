import { expect } from 'vitest'
import { normalizeURL, runVitest, test } from '../utils'

test('custom instrumenter receives correct options', async () => {
  let receivedOptions: any = null

  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      reporter: 'json',
      ignoreClassMethods: ['test-method'],
      instrumenter: options => {
        receivedOptions = options

        // Return a passthrough instrumenter — no actual instrumentation,
        // just verifying the factory is called with the right options.
        return {
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
        }
      },
    },
  }, { throwOnError: false })

  // The custom instrumenter factory should have been called
  expect(receivedOptions).not.toBeNull()

  // It should receive the coverage variable used by Vitest internally
  expect(receivedOptions.coverageVariable).toBe('__VITEST_COVERAGE__')

  // It should receive the ignoreClassMethods option
  expect(receivedOptions.ignoreClassMethods).toEqual(['test-method'])
})
