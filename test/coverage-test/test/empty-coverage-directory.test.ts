import { existsSync, rmSync } from 'node:fs'
import { beforeEach, expect } from 'vitest'
import { sum } from '../fixtures/src/math'
import { captureStdout, coverageTest, normalizeURL, runVitest, test } from '../utils'

beforeEach(() => {
  return captureStdout()
})

test('empty coverage directory is cleaned after tests', async () => {
  // `clean()` no longer sweeps other runs' `.tmp*` dirs, so clear any orphan left
  // by an earlier watch-mode test in this shared cwd before asserting removal.
  rmSync('./coverage', { recursive: true, force: true })

  await runVitest({
    include: [normalizeURL(import.meta.url)],
    testNamePattern: 'passing test',
    coverage: { reporter: 'text' },
  })

  expect(existsSync('./coverage')).toBe(false)
})

test('empty coverage directory is cleaned after failing test run', async () => {
  rmSync('./coverage', { recursive: true, force: true })

  const { exitCode } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    testNamePattern: 'failing test',
    coverage: { reporter: 'text' },
  }, { throwOnError: false })

  expect(existsSync('./coverage')).toBe(false)
  expect(exitCode).toBe(1)
})

coverageTest('passing test', () => {
  expect(sum(2, 3)).toBe(5)
})

coverageTest('failing test', () => {
  expect(sum(2, 3)).toBe(6)
})
