import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, vi } from 'vitest'
import { branch } from '../fixtures/src/branch'
import { isEven, isOdd } from '../fixtures/src/even'
import { sum } from '../fixtures/src/math'
import { coverageTest, normalizeURL, runVitest, test } from '../utils'

// Each test spawns a child Vitest via `runVitest`. With several outer
// coverage projects (v8/istanbul/native) running in parallel, those child
// processes can take a few seconds each. The default 5s test timeout is
// enough on CI (which runs the projects sequentially) but tight locally.
vi.setConfig({ testTimeout: 15_000 })

// math.ts: 1/4 functions covered (25%). even.ts: 2/2 (100%). branch.ts: only the
// true branch of the `if` is taken, so branches are 1/2 (50%).

// Each test also gets its own `reportsDirectory` so that the inner Vitest
// runs do not race on a shared `coverage/.tmp` directory.
function uniqueReportsDirectory(): string {
  return mkdtempSync(join(tmpdir(), 'vitest-threshold-per-file-'))
}

test('per-file object thresholds fail while global thresholds pass', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      reportsDirectory: uniqueReportsDirectory(),
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
      reportsDirectory: uniqueReportsDirectory(),
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
      reportsDirectory: uniqueReportsDirectory(),
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
      reportsDirectory: uniqueReportsDirectory(),
      include: [
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
    "ERROR: Coverage for lines (25%) does not meet per-file threshold (100%) for fixtures/src/math.ts
    ERROR: Coverage for functions (25%) does not meet per-file threshold (100%) for fixtures/src/math.ts
    ERROR: Coverage for statements (25%) does not meet per-file threshold (100%) for fixtures/src/math.ts
    "
  `)
})

test('per-file object thresholds with negative threshold', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      reportsDirectory: uniqueReportsDirectory(),
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
      reportsDirectory: uniqueReportsDirectory(),
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

test('per-file object thresholds only check the keys that are set', async () => {
  // Only `functions` is configured per file. `lines` and `statements` on
  // math.ts are also at 25%, so if they were checked we would see extra
  // ERROR lines for them.
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      reportsDirectory: uniqueReportsDirectory(),
      include: [
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        functions: 40,
        perFile: {
          functions: 30,
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)
  expect(stderr).toMatchInlineSnapshot(`
    "ERROR: Coverage for functions (25%) does not meet per-file threshold (30%) for fixtures/src/math.ts
    "
  `)
})

test('per-file object thresholds work for branches', async () => {
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      reportsDirectory: uniqueReportsDirectory(),
      include: [
        '**/fixtures/src/branch.ts',
      ],
      thresholds: {
        branches: 40,
        perFile: {
          branches: 80,
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)
  expect(stderr).toMatchInlineSnapshot(`
    "ERROR: Coverage for branches (50%) does not meet per-file threshold (80%) for fixtures/src/branch.ts
    "
  `)
})

test('per-file object thresholds report violations for every failing file', async () => {
  // Both math.ts (25% lines) and branch.ts (the `return false` path is
  // never taken) sit below the 80% per-file floor while even.ts is at 100%.
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      reportsDirectory: uniqueReportsDirectory(),
      include: [
        '**/fixtures/src/branch.ts',
        '**/fixtures/src/even.ts',
        '**/fixtures/src/math.ts',
      ],
      thresholds: {
        lines: 30,
        perFile: {
          lines: 80,
        },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)
  expect(stderr).toMatchInlineSnapshot(`
    "ERROR: Coverage for lines (75%) does not meet per-file threshold (80%) for fixtures/src/branch.ts
    ERROR: Coverage for lines (25%) does not meet per-file threshold (80%) for fixtures/src/math.ts
    "
  `)
})

coverageTest('cover some lines, but not too much', async () => {
  expect(sum(1, 2)).toBe(3)
  expect(isEven(4)).toBe(true)
  expect(isOdd(4)).toBe(false)
  expect(await branch(15)).toBe(true)
})
