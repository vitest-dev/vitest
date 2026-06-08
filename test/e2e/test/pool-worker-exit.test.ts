import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'

const fixtureDir = resolve(import.meta.dirname, '../fixtures/pool-worker-exit')
const coverageFinal = resolve(fixtureDir, 'coverage/coverage-final.json')

test('worker death on a shared runner does not skip coverage finalization', () => {
  rmSync(resolve(fixtureDir, 'coverage'), { force: true, recursive: true })

  try {
    execFileSync(
      'node',
      [
        resolve(import.meta.dirname, '../../../packages/vitest/vitest.mjs'),
        'run',
        '--reporter=default',
      ],
      {
        cwd: fixtureDir,
        encoding: 'utf-8',
        timeout: 45_000,
        stdio: 'pipe',
      },
    )
  }
  catch {
    // vitest is expected to exit non-zero because of the worker crash
  }

  expect(
    existsSync(coverageFinal),
    `coverage-final.json must exist — its absence means runFiles.finally was skipped`,
  ).toBe(true)

  const report = JSON.parse(readFileSync(coverageFinal, 'utf-8'))
  const entry = Object.values(report).find((file: any) => file.path.endsWith('src.js')) as any

  expect(entry, 'src.js should be present in the coverage report').toBeDefined()
  expect(
    Object.values(entry.s).some((count: any) => count > 0),
    'covered() should have at least one recorded execution',
  ).toBe(true)
}, 60_000)
