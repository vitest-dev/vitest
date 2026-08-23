import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, expect } from 'vitest'
import { sum } from '../fixtures/src/math'
import { captureStdout, coverageTest, normalizeURL, runVitest, test } from '../utils'

beforeEach(() => {
  return captureStdout()
})

/**
 * `onTestRunEnd` fires after the provider has read `.tmp/*.json` and before it
 * calls `cleanAfterRun()`, which is the window where something else — a second
 * Vitest process, a CI cleanup step, a container volume — can remove the
 * directory out from under the cleanup.
 */
function removeDirectory(directory: string) {
  return {
    onTestRunEnd() {
      rmSync(resolve(process.cwd(), directory), { recursive: true, force: true })
    },
  }
}

test('coverage temp directory removed mid-run does not fail the run', async () => {
  const { exitCode } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    testNamePattern: 'passing test',
    coverage: { reporter: 'text' },
    reporters: ['default', removeDirectory('coverage/.tmp')],
  }, { throwOnError: false })

  expect(exitCode).toBe(0)
})

test('coverage reports directory removed mid-run does not fail the run', async () => {
  const { exitCode } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    testNamePattern: 'passing test',
    coverage: { reporter: 'text' },
    reporters: ['default', removeDirectory('coverage')],
  }, { throwOnError: false })

  expect(exitCode).toBe(0)
})

coverageTest('passing test', () => {
  expect(sum(2, 3)).toBe(5)
})
