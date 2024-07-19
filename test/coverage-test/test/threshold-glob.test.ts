import { expect } from 'vitest'
import { coverageTest, isV8Provider, normalizeURL, runVitest, test } from '../utils'
import { sum } from '../fixtures/src/math'

test('threshold glob patterns count in global coverage', async () => {
  const { exitCode } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      all: false,
      include: ['**/fixtures/src/math.ts'],
      thresholds: {
        'branches': 100,
        'functions': 25,
        'lines': isV8Provider() ? 50 : 25,
        'statements': isV8Provider() ? 50 : 25,

        '**/fixtures/src/math.ts': {
          branches: 100,
          functions: 25,
          lines: isV8Provider() ? 50 : 25,
          statements: isV8Provider() ? 50 : 25,
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(0)
})

coverageTest('cover some lines, but not too much', () => {
  expect(sum(1, 2)).toBe(3)
})
