import { expect } from 'vitest'
import { coverageTest, isV8Provider, normalizeURL, runVitest, test } from '../utils'
import { sum } from '../fixtures/src/math'
import { isEven, isOdd } from '../fixtures/src/even'

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

coverageTest('cover some lines, but not too much', () => {
  expect(sum(1, 2)).toBe(3)
  expect(isEven(4)).toBe(true)
  expect(isOdd(4)).toBe(false)
})
