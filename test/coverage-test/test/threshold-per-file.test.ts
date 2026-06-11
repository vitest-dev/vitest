import { expect } from 'vitest'
import { branch } from '../fixtures/src/branch'
import { isEven, isOdd } from '../fixtures/src/even'
import { sum } from '../fixtures/src/math'
import { coverageTest, normalizeURL, runVitest, test } from '../utils'

// math.ts: 1/4 functions covered (25%). even.ts: 2/2 (100%). branch.ts: only the
// true branch of the `if` is taken, so branches are 1/2 (50%).

test('per-file object thresholds fail while global thresholds pass', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: [
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        functions: 40,
        perFile: {
          functions: 50,
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

test('global thresholds fail while per-file object thresholds pass', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: [
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        functions: 70,
        perFile: {
          functions: 20,
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)
  expect(stderr).toMatchInlineSnapshot(`
    "ERROR: Coverage for functions (50%) does not meet global threshold (70%)
    "
  `)
})

test('both global and per-file object thresholds pass', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: [
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        functions: 40,
        perFile: {
          functions: 20,
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(0)
  expect(stderr).toMatchInlineSnapshot(`""`)
})

test('per-file object thresholds with { 100: true }', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: [
        '**/fixtures/src/branch.ts',
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        functions: 40,
        perFile: {
          100: true,
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)
  expect(stderr).toMatchInlineSnapshot(`
    "ERROR: Coverage for lines (75%) does not meet per-file threshold (100%) for fixtures/src/branch.ts
    ERROR: Coverage for statements (75%) does not meet per-file threshold (100%) for fixtures/src/branch.ts
    ERROR: Coverage for branches (50%) does not meet per-file threshold (100%) for fixtures/src/branch.ts
    ERROR: Coverage for lines (25%) does not meet per-file threshold (100%) for fixtures/src/math.ts
    ERROR: Coverage for functions (25%) does not meet per-file threshold (100%) for fixtures/src/math.ts
    ERROR: Coverage for statements (25%) does not meet per-file threshold (100%) for fixtures/src/math.ts
    "
  `)
})

test('per-file object thresholds with negative threshold', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: [
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        functions: 40,
        perFile: {
          functions: -1,
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)
  expect(stderr).toMatchInlineSnapshot(`
    "ERROR: Uncovered functions (3) exceed per-file threshold (1) for fixtures/src/math.ts
    "
  `)
})

test('per-file object thresholds with empty object are a no-op', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: [
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        functions: 40,
        perFile: {},
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(0)
  expect(stderr).toMatchInlineSnapshot(`""`)
})

test('top-level perFile does not cascade to glob thresholds', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: [
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        'perFile': true,
        '**/fixtures/src/*.ts': {
          functions: 40,
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(0)
  expect(stderr).toMatchInlineSnapshot(`""`)
})

test('top-level perFile applies globally but not to a glob without its own perFile', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: [
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        'functions': 30,
        'perFile': true,
        '**/fixtures/src/even.ts': {
          functions: 40,
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)
  expect(stderr).toMatchInlineSnapshot(`
    "ERROR: Coverage for functions (25%) does not meet global threshold (30%) for fixtures/src/math.ts
    "
  `)
})

coverageTest('cover some lines, but not too much', async () => {
  expect(sum(1, 2)).toBe(3)
  expect(isEven(4)).toBe(true)
  expect(isOdd(4)).toBe(false)
  expect(await branch(15)).toBe(true)
})
