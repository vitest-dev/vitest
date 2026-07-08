import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

const fixture = resolve(import.meta.dirname, '../fixtures/compile-cache')
const cacheDir = resolve(fixture, 'node_modules/.cache/compile-cache-test')

function cacheEntries(): string[] {
  return readdirSync(cacheDir, { recursive: true, encoding: 'utf-8' })
    .filter(file => statSync(join(cacheDir, file)).isFile())
}

test('NODE_COMPILE_CACHE redirects the compile cache and the worker persists its graph', async () => {
  rmSync(cacheDir, { recursive: true, force: true })

  // the fixture test asserts that the worker sees this exact NODE_COMPILE_CACHE
  const { exitCode } = await runVitestCli(
    { nodeOptions: { env: {
      NODE_COMPILE_CACHE: cacheDir,
      EXPECTED_COMPILE_CACHE_DIR: cacheDir,
    } } },
    'run',
    '--root',
    fixture,
  )

  expect(exitCode).toBe(0)

  // jsdom is only loaded inside the worker, so its modules can reach the
  // cache only through the worker flush — the CLI graph alone is ~150 entries,
  // the worker graph pushes it past 1000
  expect(cacheEntries().length).toBeGreaterThan(300)
})

test('NODE_DISABLE_COMPILE_CACHE wins over NODE_COMPILE_CACHE', async () => {
  rmSync(cacheDir, { recursive: true, force: true })

  const { exitCode } = await runVitestCli(
    { nodeOptions: { env: {
      NODE_COMPILE_CACHE: cacheDir,
      NODE_DISABLE_COMPILE_CACHE: '1',
    } } },
    'run',
    '--root',
    fixture,
  )

  expect(exitCode).toBe(0)
  expect(existsSync(cacheDir)).toBe(false)
})
