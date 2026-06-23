import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { assert, expect, onTestFinished, test } from 'vitest'
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

test('clean() acquires the reportsDirectory lock and cleanAfterRun() releases it', async () => {
  const { provider, lockFile } = createProvider()

  await provider.clean(true)

  expect(existsSync(provider.coverageFilesDirectory)).toBe(true)
  expect(existsSync(lockFile)).toBe(true)
  expect(JSON.parse(readFileSync(lockFile, 'utf-8')).pid).toBe(process.pid)

  await provider.cleanAfterRun()

  expect(existsSync(lockFile)).toBe(false)
})

test('clean() is re-entrant for the same process (e.g. watch mode reruns)', async () => {
  const { provider } = createProvider()

  await provider.clean(true)

  // Should not throw lockfile acquiring errors
  await expect(provider.clean(true)).resolves.toBeUndefined()

  await provider.cleanAfterRun()
})

test('clean() throws an actionable error when another live process holds the lock', async () => {
  const { provider, reportsDirectory, lockFile } = createProvider()

  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  onTestFinished(() => void child.kill())
  await new Promise(resolve => child.once('spawn', resolve))

  const childPid = child.pid
  assert(childPid != null, 'child process did not start')

  writeFileSync(lockFile, JSON.stringify({ pid: childPid, reportsDirectory }))

  await expect(provider.clean(true)).rejects.toThrow(
    `The coverage report directory "${reportsDirectory}" is already in use by `
    + `another Vitest process (pid ${childPid}). Running coverage for multiple `
    + `Vitest processes in the same directory at the same time is not supported, because they would `
    + `delete each other's reports.\nGive each run its own "coverage.reportsDirectory" `
    + `(e.g. --coverage.reportsDirectory=coverage-${process.pid}) or run them sequentially.`,
  )

  expect(JSON.parse(readFileSync(lockFile, 'utf-8')).pid).toBe(childPid)
})

test('clean() reclaims an empty / non-JSON lock file without crashing', async () => {
  const { provider, lockFile } = createProvider()

  writeFileSync(lockFile, 'not-valid-json{')

  await expect(provider.clean(true)).resolves.toBeUndefined()

  expect(JSON.parse(readFileSync(lockFile, 'utf-8')).pid).toBe(process.pid)

  await provider.cleanAfterRun()
})

test('clean() reclaims a stale lock left by a process that no longer exists', async () => {
  const { provider, reportsDirectory, lockFile } = createProvider()

  const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' })
  await new Promise(resolve => child.once('exit', resolve))

  const deadPid = child.pid
  assert(deadPid != null, 'child process did not start')

  writeFileSync(lockFile, JSON.stringify({ pid: deadPid, reportsDirectory }))

  await expect(provider.clean(true)).resolves.toBeUndefined()

  expect(JSON.parse(readFileSync(lockFile, 'utf-8')).pid).toBe(process.pid)

  await provider.cleanAfterRun()
})

function createProvider() {
  const reportsDirectory = mkdtempSync(join(tmpdir(), 'vitest-coverage-reports-'))
  onTestFinished(() => rmSync(reportsDirectory, { recursive: true, force: true }))

  const provider = new BaseCoverageProvider()
  provider.coverageFilesDirectory = join(reportsDirectory, '.tmp')
  provider.options = { reportsDirectory } as any

  // eslint-disable-next-line dot-notation -- Accessing private property
  const lockFile = provider['reportsDirectoryLock'].lockFile
  onTestFinished(() => rmSync(lockFile, { force: true }))

  return { provider, reportsDirectory, lockFile }
}
