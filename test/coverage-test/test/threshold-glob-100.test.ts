import { expect } from 'vitest'
import { coverageTest, isV8Provider, normalizeURL, runVitest, test } from '../utils'
import { sum } from '../fixtures/src/math'
import { isEven, isOdd } from '../fixtures/src/even'

test('{thresholds: { 100: true }} on glob pattern', async () => {
  const result = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: [
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      reporter: ['text'],
      thresholds: {
        'branches': 100,

        // Replace these after #6170 is merged ─ Makes glob pattern files be counted toward global thresholds
        // 'functions': 50,
        // 'lines': isV8Provider() ? 66.66 : 50,
        // 'statements': isV8Provider() ? 66.66 : 50,
        'functions': 25,
        'lines': isV8Provider() ? 50 : 25,
        'statements': isV8Provider() ? 50 : 25,

        '**/fixtures/src/even.ts': {
          100: true,
        },
      },
    },
  }, { throwOnError: false })

  expect(result.exitCode).toBe(0)
})

coverageTest('thresholds[\'glob-pattern\'].100 sets thresholds to 100 for said glob pattern', () => {
  expect(sum(1, 2)).toBe(3)
  expect(isEven(2)).toBe(true)
  expect(isEven(1)).toBe(false)
  expect(isOdd(3)).toBe(true)
  expect(isOdd(4)).toBe(false)
})
