import { expect } from 'vitest'
import { sum } from '../fixtures/src/math'
import { coverageTest, normalizeURL, runVitest, test } from '../utils'

test('perFile as object enforces per-file thresholds while global thresholds still apply', async () => {
  // math.ts has ~25% line coverage when only sum() is called.
  // Global threshold (lines: 10%) passes — no global error.
  // Per-file threshold (lines: 100%) fails — per-file error with filename.
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: ['**/fixtures/src/math.ts'],
      thresholds: {
        lines: 10,
        perFile: { lines: 100 },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)
  // global passes (25% >= 10%) — no global error
  expect(stderr).not.toContain('does not meet global threshold (10%)')
  // per-file fails (25% < 100%) — error includes the filename
  expect(stderr).toContain('does not meet global threshold (100%)')
  expect(stderr).toContain('math.ts')
})

test('perFile as object failing global threshold also reported', async () => {
  // Global threshold (lines: 90%) fails.
  // Per-file threshold (lines: 100%) also fails.
  // Both errors should appear.
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: ['**/fixtures/src/math.ts'],
      thresholds: {
        lines: 90,
        perFile: { lines: 100 },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)
  // global fails
  expect(stderr).toContain('does not meet global threshold (90%)')
  // per-file also fails with filename
  expect(stderr).toContain('does not meet global threshold (100%)')
  expect(stderr).toContain('math.ts')
})

test('perFile as object with passing thresholds does not fail', async () => {
  const { exitCode } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: ['**/fixtures/src/math.ts'],
      thresholds: {
        lines: 10,
        perFile: { lines: 10 },
      },
    },
  })

  expect(exitCode).toBe(0)
})

test('perFile as object only checks the keys specified in the object', async () => {
  // Only lines is specified in perFile — functions/branches/statements not checked per file
  const { exitCode, stderr } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: ['**/fixtures/src/math.ts'],
      thresholds: {
        perFile: { lines: 100 },
      },
    },
  }, { throwOnError: false })

  expect(exitCode).toBe(1)
  expect(stderr).toContain('lines')
  expect(stderr).not.toContain('functions')
  expect(stderr).not.toContain('branches')
  expect(stderr).not.toContain('statements')
})

coverageTest('cover some lines', () => {
  expect(sum(1, 2)).toBe(3)
})
