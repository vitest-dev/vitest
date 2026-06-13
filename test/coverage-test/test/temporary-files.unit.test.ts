import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, onTestFinished, test } from 'vitest'
import { BaseCoverageProvider } from 'vitest/node'

function createProvider() {
  const reportsDirectory = mkdtempSync(join(tmpdir(), 'vitest-coverage-reports-'))
  const provider = new BaseCoverageProvider()
  provider.coverageFilesDirectory = join(reportsDirectory, '.tmp')
  provider.options = { reportsDirectory } as any

  const lockFile = (provider as any).reportsDirectoryLock.lockFile as string

  onTestFinished(() => {
    rmSync(reportsDirectory, { recursive: true, force: true })
    rmSync(lockFile, { force: true })
  })

  return { provider, reportsDirectory, lockFile }
}

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

  await expect(provider.clean(true)).resolves.toBeUndefined()

  await provider.cleanAfterRun()
})

test('clean() throws an actionable error when another live process holds the lock', async () => {
  const { provider, reportsDirectory, lockFile } = createProvider()

  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  await new Promise(resolve => child.once('spawn', resolve))
  onTestFinished(() => {
    child.kill()
  })

  const childPid = child.pid
  if (childPid == null) {
    throw new Error('child process did not start')
  }

  const timestamp = Date.now()
  writeFileSync(lockFile, JSON.stringify({ pid: childPid, reportsDirectory, timestamp, nonce: randomUUID() }))

  await expect(provider.clean(true)).rejects.toThrow(
    `The coverage report directory "${reportsDirectory}" is already in use by `
    + `another Vitest process (pid ${childPid} since ${new Date(timestamp).toISOString()}). Running coverage for multiple Vitest `
    + `processes in the same directory at the same time is not supported, because they would delete `
    + `each other's reports.\nGive each run its own "coverage.reportsDirectory" `
    + `(e.g. --coverage.reportsDirectory=coverage-${process.pid}) or run them sequentially.`,
  )

  expect(JSON.parse(readFileSync(lockFile, 'utf-8')).pid).toBe(childPid)
})

test('clean() reclaims a lock whose reportsDirectory does not match (identity mismatch)', async () => {
  const { provider, lockFile } = createProvider()

  // Same live pid as us, but a different reportsDirectory: it is not our lock,
  // so it must be reclaimed without depending on a real dead pid (which the OS
  // can recycle, making a process.kill-based test flaky).
  writeFileSync(lockFile, JSON.stringify({
    pid: process.pid,
    reportsDirectory: '/some/other/coverage/directory',
    timestamp: Date.now(),
    nonce: randomUUID(),
  }))

  await expect(provider.clean(true)).resolves.toBeUndefined()

  const owner = JSON.parse(readFileSync(lockFile, 'utf-8'))
  expect(owner.pid).toBe(process.pid)
  expect(owner.reportsDirectory).toBe(provider.options.reportsDirectory)

  await provider.cleanAfterRun()
})

test('clean() reclaims an empty / non-JSON lock file without crashing', async () => {
  const { provider, lockFile } = createProvider()

  writeFileSync(lockFile, 'not-valid-json{')

  await expect(provider.clean(true)).resolves.toBeUndefined()

  expect(JSON.parse(readFileSync(lockFile, 'utf-8')).pid).toBe(process.pid)

  await provider.cleanAfterRun()
})

test('clean() reclaims a lock missing a numeric timestamp without throwing RangeError', async () => {
  const { provider, reportsDirectory, lockFile } = createProvider()

  // A parseable lock with a numeric pid + matching reportsDirectory but no
  // timestamp (older-format / partial-but-valid JSON). The hardened readOwner
  // treats the incomplete shape as corrupt and reclaims it, instead of reaching
  // the fail-fast branch where new Date(undefined).toISOString() would throw.
  writeFileSync(lockFile, JSON.stringify({ pid: process.pid, reportsDirectory }))

  await expect(provider.clean(true)).resolves.toBeUndefined()

  const owner = JSON.parse(readFileSync(lockFile, 'utf-8'))
  expect(owner.pid).toBe(process.pid)
  expect(typeof owner.timestamp).toBe('number')

  await provider.cleanAfterRun()
})

test('clean() reclaims a stale lock left by a process that no longer exists', async () => {
  const { provider, reportsDirectory, lockFile } = createProvider()

  const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' })
  await new Promise(resolve => child.once('exit', resolve))
  const deadPid = child.pid
  if (deadPid == null) {
    throw new Error('child process did not start')
  }

  writeFileSync(lockFile, JSON.stringify({ pid: deadPid, reportsDirectory, timestamp: Date.now(), nonce: randomUUID() }))

  await expect(provider.clean(true)).resolves.toBeUndefined()

  expect(JSON.parse(readFileSync(lockFile, 'utf-8')).pid).toBe(process.pid)

  await provider.cleanAfterRun()
})

test('a child process that acquires the lock and exits cleanly leaves no lock file behind', async () => {
  const reportsDirectory = mkdtempSync(join(tmpdir(), 'vitest-coverage-reports-'))
  const probe = new BaseCoverageProvider()
  probe.coverageFilesDirectory = join(reportsDirectory, '.tmp')
  probe.options = { reportsDirectory } as any
  const lockFile = (probe as any).reportsDirectoryLock.lockFile as string

  onTestFinished(() => {
    rmSync(reportsDirectory, { recursive: true, force: true })
    rmSync(lockFile, { force: true })
  })

  const script = `
    import { BaseCoverageProvider } from 'vitest/node'
    const provider = new BaseCoverageProvider()
    provider.coverageFilesDirectory = ${JSON.stringify(join(reportsDirectory, '.tmp'))}
    provider.options = { reportsDirectory: ${JSON.stringify(reportsDirectory)} }
    await provider.clean(true)
    process.exit(0)
  `

  const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
    stdio: 'ignore',
    cwd: resolve(import.meta.dirname, '..'),
  })
  const code = await new Promise<number>(resolve => child.once('exit', resolve))

  expect(code).toBe(0)
  expect(existsSync(lockFile)).toBe(false)
})

test('restoreInode keeps the displaced file when the canonical path is already re-taken', async () => {
  const { provider, lockFile } = createProvider()
  const lock = (provider as any).reportsDirectoryLock

  // Simulate the 3-process window: another claimant has already republished a
  // live lock at the canonical path while we still hold the displaced inode at
  // stalePath. restoreInode must NOT delete stalePath (it is the displaced
  // owner's only remaining copy), so the live lock content is never lost.
  const stalePath = `${lockFile}.${process.pid}.${randomUUID()}.stale`
  writeFileSync(stalePath, JSON.stringify({ pid: 4242, reportsDirectory: '/displaced', timestamp: Date.now(), nonce: randomUUID() }))
  writeFileSync(lockFile, JSON.stringify({ pid: process.pid, reportsDirectory: 'whatever', timestamp: Date.now(), nonce: randomUUID() }))

  onTestFinished(() => {
    rmSync(stalePath, { force: true })
  })

  await lock.restoreInode(stalePath)

  expect(existsSync(stalePath)).toBe(true)
  expect(JSON.parse(readFileSync(stalePath, 'utf-8')).reportsDirectory).toBe('/displaced')
})
