import { expect } from 'vitest'
import { sum } from '../fixtures/src/math'
import { coverageTest, isV8Provider, normalizeURL, runVitest, test } from '../utils'

test('failing percentage thresholds', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      all: false,
      include: ['**/fixtures/src/math.ts'],
      thresholds: {
        '**/fixtures/src/math.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
  }, { throwOnError: false })

  const lines = isV8Provider() ? '50%' : '25%'
  const statements = isV8Provider() ? '50%' : '25%'

  expect(exitCode).toBe(1)
  expect(stderr).toContain(`ERROR: Coverage for lines (${lines}) does not meet "**/fixtures/src/math.ts" threshold (100%)`)
  expect(stderr).toContain(`ERROR: Coverage for statements (${statements}) does not meet "**/fixtures/src/math.ts" threshold (100%)`)
  expect(stderr).toContain('ERROR: Coverage for functions (25%) does not meet "**/fixtures/src/math.ts" threshold (100%)')
})

coverageTest('cover some lines, but not too much', () => {
  expect(sum(1, 2)).toBe(3)
})
