import { expect } from 'vitest'
import { isEven, isOdd } from '../fixtures/src/even'
import { sum } from '../fixtures/src/math'
import { coverageTest, isV8Provider, normalizeURL, runVitest, test } from '../utils'

test('threshold glob patterns count in global coverage', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      all: false,
      include: ['**/fixtures/src/**'],
      thresholds: {
        'branches': 100,
        'functions': 50,
        'lines': isV8Provider() ? 66 : 50,
        'statements': isV8Provider() ? 66 : 50,

        '**/fixtures/src/even.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
  })
})

test('{ thresholds: { 100: true } } on glob pattern', async () => {
  const { stderr, exitCode } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: [
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        '**/fixtures/src/even.ts': {
          100: true,
        },
        '**/fixtures/src/math.ts': {
          100: true,
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)

  if (isV8Provider()) {
    expect(stderr).toMatchInlineSnapshot(`
      "ERROR: Coverage for lines (50%) does not meet "**/fixtures/src/math.ts" threshold (100%)
      ERROR: Coverage for functions (25%) does not meet "**/fixtures/src/math.ts" threshold (100%)
      ERROR: Coverage for statements (50%) does not meet "**/fixtures/src/math.ts" threshold (100%)
      "
    `)
  }
  else {
    expect(stderr).toMatchInlineSnapshot(`
      "ERROR: Coverage for lines (25%) does not meet "**/fixtures/src/math.ts" threshold (100%)
      ERROR: Coverage for functions (25%) does not meet "**/fixtures/src/math.ts" threshold (100%)
      ERROR: Coverage for statements (25%) does not meet "**/fixtures/src/math.ts" threshold (100%)
      "
    `)
  }
})

coverageTest('cover some lines, but not too much', () => {
  expect(sum(1, 2)).toBe(3)
  expect(isEven(4)).toBe(true)
  expect(isOdd(4)).toBe(false)
})
