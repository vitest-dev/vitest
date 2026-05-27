import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { BaseCoverageProvider } from 'vitest/node'

test('missing coverage temp directory throws an actionable error', async () => {
  const provider = new BaseCoverageProvider()
  provider.coverageFilesDirectory = resolve('missing-coverage-directory', '.tmp')

  provider.onAfterSuiteRun({
    coverage: { '/src/math.ts': {} },
    environment: 'ssr',
    projectName: '',
    testFiles: ['math.test.ts'],
  } as any)

  await expect(Promise.all(provider.pendingPromises)).rejects.toThrow(
    `Something removed the coverage directory "${provider.coverageFilesDirectory}" Vitest created earlier. Make sure you are not running multiple Vitests with the same "coverage.reportsDirectory" at the same time.`,
  )
})

test('cleanAfterRun resolves without error when temp directory is already absent', async () => {
  const provider = new BaseCoverageProvider()
  provider.coverageFilesDirectory = resolve('non-existent-coverage-directory', '.tmp-already-gone')
  provider.options = { reportsDirectory: resolve('non-existent-coverage-directory') } as any

  // AC-1: with force:true, cleanAfterRun must not throw a raw ENOENT
  await expect(provider.cleanAfterRun()).resolves.toBeUndefined()
})

test('clean() preserves a concurrent run\'s temp directory while removing stale reports', async () => {
  const reportsDirectory = mkdtempSync(join(tmpdir(), 'vitest-coverage-'))
  const siblingTmp = join(reportsDirectory, '.tmp-sibling-run')
  const staleReport = join(reportsDirectory, 'coverage-final.json')
  mkdirSync(siblingTmp, { recursive: true })
  writeFileSync(join(siblingTmp, 'coverage-0.json'), '{}')
  writeFileSync(staleReport, '{}')

  const provider = new BaseCoverageProvider()
  provider.coverageFilesDirectory = join(reportsDirectory, '.tmp-mine')
  provider.options = { reportsDirectory } as any

  await provider.clean(true)

  expect(existsSync(siblingTmp)).toBe(true)
  expect(existsSync(join(siblingTmp, 'coverage-0.json'))).toBe(true)
  expect(existsSync(staleReport)).toBe(false)
  expect(existsSync(provider.coverageFilesDirectory)).toBe(true)

  rmSync(reportsDirectory, { recursive: true, force: true })
})

test('cleanAfterRun() does not delete a concurrent run\'s temp directory', async () => {
  const reportsDirectory = mkdtempSync(join(tmpdir(), 'vitest-coverage-'))
  const siblingTmp = join(reportsDirectory, '.tmp-sibling-run')
  const ownTmp = join(reportsDirectory, '.tmp-mine')
  mkdirSync(siblingTmp, { recursive: true })
  mkdirSync(ownTmp, { recursive: true })

  const provider = new BaseCoverageProvider()
  provider.coverageFilesDirectory = ownTmp
  provider.options = { reportsDirectory } as any

  await provider.cleanAfterRun()

  expect(existsSync(ownTmp)).toBe(false)
  expect(existsSync(siblingTmp)).toBe(true)
  expect(existsSync(reportsDirectory)).toBe(true)

  rmSync(reportsDirectory, { recursive: true, force: true })
})
