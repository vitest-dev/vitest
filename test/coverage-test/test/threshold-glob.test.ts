import { expect } from 'vitest'
import { isEven, isOdd } from '../fixtures/src/even'
import { sum } from '../fixtures/src/math'
import { coverageTest, normalizeURL, runVitest, test } from '../utils'

test('threshold glob patterns count in global coverage', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: [
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        'branches': 100,
        'functions': 50,
        'lines': 50,
        'statements': 50,

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

  expect(stderr).toMatchInlineSnapshot(`
    "ERROR: Coverage for lines (25%) does not meet "**/fixtures/src/math.ts" threshold (100%)
    ERROR: Coverage for functions (25%) does not meet "**/fixtures/src/math.ts" threshold (100%)
    ERROR: Coverage for statements (25%) does not meet "**/fixtures/src/math.ts" threshold (100%)
    "
  `)
})

test('per-file boolean on glob pattern checks each matching file', async () => {
  const { stderr, exitCode } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: [
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        '**/fixtures/src/*.ts': {
          functions: 50,
          perFile: true,
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)
  expect(stderr).toMatchInlineSnapshot(`
    "ERROR: Coverage for functions (25%) does not meet "**/fixtures/src/*.ts" threshold (50%) for fixtures/src/math.ts
    "
  `)
})

test('per-file object on glob pattern adds per-file minimums', async () => {
  const { stderr, exitCode } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: [
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        '**/fixtures/src/*.ts': {
          functions: 20,
          perFile: {
            functions: 50,
          },
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)
  expect(stderr).toMatchInlineSnapshot(`
    "ERROR: Coverage for functions (25%) does not meet per-file threshold (50%) for fixtures/src/math.ts
    "
  `)
})

test('per-file { 100: true } on glob pattern with no aggregate thresholds', async () => {
  const { stderr, exitCode } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: [
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        '**/fixtures/src/*.ts': {
          perFile: {
            100: true,
          },
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)
  expect(stderr).toMatchInlineSnapshot(`
    "ERROR: Coverage for lines (25%) does not meet per-file threshold (100%) for fixtures/src/math.ts
    ERROR: Coverage for functions (25%) does not meet per-file threshold (100%) for fixtures/src/math.ts
    ERROR: Coverage for statements (25%) does not meet per-file threshold (100%) for fixtures/src/math.ts
    "
  `)
})

coverageTest('cover some lines, but not too much', () => {
  expect(sum(1, 2)).toBe(3)
  expect(isEven(4)).toBe(true)
  expect(isOdd(4)).toBe(false)
})
