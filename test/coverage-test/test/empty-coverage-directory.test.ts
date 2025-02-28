import { existsSync } from 'node:fs'
import { beforeEach, expect } from 'vitest'
import { sum } from '../fixtures/src/math'
import { captureStdout, coverageTest, normalizeURL, runVitest, test } from '../utils'

beforeEach(() => {
  return captureStdout()
})

test('empty coverage directory is cleaned after tests', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    testNamePattern: 'passing test',
    coverage: { reporter: 'text', all: false },
  })

  expect(existsSync('./coverage')).toBe(false)
})

test('empty coverage directory is cleaned after failing test run', async () => {
  const { exitCode } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    testNamePattern: 'failing test',
    coverage: { reporter: 'text', all: false },
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
