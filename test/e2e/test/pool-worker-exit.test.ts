import { execFileSync } from 'node:child_process'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'

const fixtureDir = resolve(import.meta.dirname, '../fixtures/pool-worker-exit')

test('vitest reports a Worker exited error and exits when a fork worker is killed mid-run on a shared runner', () => {
  let stdout = ''
  let stderr = ''
  let exitCode = 0

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
  catch (error: any) {
    stdout = String(error.stdout ?? '')
    stderr = String(error.stderr ?? '')
    exitCode = error.status ?? 1
  }

  expect(exitCode, `vitest should have exited (not been killed for timeout)\n${stdout}\n${stderr}`).not.toBe(null)
  expect(stderr + stdout).toMatch(/Worker exited unexpectedly/i)
}, 60_000)
