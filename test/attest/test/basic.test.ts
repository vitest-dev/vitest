import type { SpawnOptions } from 'node:child_process'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { editFile, runVitestCli } from '../../test-utils'

it('skip types', { timeout: 20_000 }, async () => {
  // for now, use cli since cwd is essential for attest
  const dir = join(import.meta.dirname, '../fixtures')
  const options: SpawnOptions = { cwd: dir }

  // [ATTEST] pass with correct snapshots
  let result = await runVitestCli({ nodeOptions: options }, 'run', '--attest')
  expect(result.stderr).toBe('')
  expect(result.stdout).toContain('Waiting for TypeScript')
  expect(result.stdout).toContain('Test Files  2 passed')

  // [NO ATTEST] pass with wrong snapshot
  editFile(
    join(dir, 'test/__snapshots__/snapshot.test.ts.snap'),
    s => s.replace('exports[`file snapshot 1`] = `number`', ''),
  )
  result = await runVitestCli({ nodeOptions: options }, 'run', '--update')
  expect(result.stderr).toBe('')
  expect(result.stdout).not.toContain('Waiting for TypeScript')
  expect(result.stdout).not.toContain('Snapshots 1 written')
  expect(result.stdout).not.toContain('obsolete')
  expect(result.stdout).toContain('Test Files  2 passed')

  // [ATTEST] update snapshot
  result = await runVitestCli({ nodeOptions: options }, 'run', '--attest', '--update')
  expect(result.stderr).toBe('')
  expect(result.stdout).toContain('Waiting for TypeScript')
  expect(result.stdout).toContain('Snapshots  1 written')
  expect(result.stdout).toContain('Test Files  2 passed')
})
