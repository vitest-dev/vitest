import { expect } from 'vitest'
import { sum } from '../fixtures/src/math'
import { coverageTest, isV8Provider, normalizeURL, runVitest, test } from '../utils'

test('failing absolute thresholds', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      all: false,
      include: ['**/fixtures/src/math.ts'],
      thresholds: {
        '**/fixtures/src/math.ts': {
          branches: -1,
          functions: -2,
          lines: -5,
          statements: -1,
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)
  if (isV8Provider()) {
    expect(stderr).toContain(`ERROR: Uncovered lines (6) exceed "**/fixtures/src/math.ts" threshold (5)`)
    expect(stderr).toContain(`ERROR: Uncovered functions (3) exceed "**/fixtures/src/math.ts" threshold (2)`)
    expect(stderr).toContain('ERROR: Uncovered statements (6) exceed "**/fixtures/src/math.ts" threshold (1)')
  }
  else {
    expect(stderr).toContain(`ERROR: Uncovered functions (3) exceed "**/fixtures/src/math.ts" threshold (2)`)
    expect(stderr).toContain('ERROR: Uncovered statements (3) exceed "**/fixtures/src/math.ts" threshold (1)')
  }
})

coverageTest('cover some lines, but not too much', () => {
  expect(sum(1, 2)).toBe(3)
})
