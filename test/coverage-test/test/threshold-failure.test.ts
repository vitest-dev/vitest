import { expect } from 'vitest'
import { sum } from '../fixtures/src/math'
import { coverageTest, normalizeURL, runVitest, test } from '../utils'

test('failing percentage thresholds', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
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

  expect(exitCode).toBe(1)
  expect(stderr).toContain('ERROR: Coverage for lines (25%) does not meet "**/fixtures/src/math.ts" threshold (100%)')
  expect(stderr).toContain('ERROR: Coverage for statements (25%) does not meet "**/fixtures/src/math.ts" threshold (100%)')
  expect(stderr).toContain('ERROR: Coverage for functions (25%) does not meet "**/fixtures/src/math.ts" threshold (100%)')
})

test('failing absolute thresholds', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: ['**/fixtures/src/math.ts'],
      thresholds: {
        '**/fixtures/src/math.ts': {
          branches: -1,
          functions: -2,
          lines: -2,
          statements: -1,
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)

  expect(stderr).toContain('ERROR: Uncovered functions (3) exceed "**/fixtures/src/math.ts" threshold (2)')
  expect(stderr).toContain('ERROR: Uncovered statements (3) exceed "**/fixtures/src/math.ts" threshold (1)')
  expect(stderr).toContain('ERROR: Uncovered lines (3) exceed "**/fixtures/src/math.ts" threshold (2)')
})

coverageTest('cover some lines, but not too much', () => {
  expect(sum(1, 2)).toBe(3)
})
