import { join } from 'node:path'
import { expect, it } from 'vitest'
import { editFile, runVitestCli } from '../../test-utils'

it('skip types', { timeout: 20_000 }, async () => {
  // for now, use cli since cwd is essential for attest
  const dir = join(import.meta.dirname, '../fixtures')

  // normal run with correct snapshots
  let result = await runVitestCli({ nodeOptions: { cwd: dir } }, 'run')
  expect(result.stdout).toContain('Waiting for TypeScript')
  expect(result.stdout).toContain('Test Files  1 passed')

  // skipTypes run with wrong snapshots
  editFile(
    join(dir, 'test/__snapshots__/snapshot.test.ts.snap'),
    s => s.replace('exports[`file 1`] = `number`', ''),
  )
  result = await runVitestCli({
    nodeOptions: {
      cwd: dir,
      env: { ...process.env, ATTEST_skipTypes: '1' },
    },
  }, 'run', '--update')
  expect(result.stdout).not.toContain('Waiting for TypeScript')
  expect(result.stdout).not.toContain('obsolete')
  expect(result.stdout).toContain('Test Files  1 passed')

  // update snapshot
  result = await runVitestCli({ nodeOptions: { cwd: dir } }, 'run', '--update')
  expect(result.stdout).toContain('Waiting for TypeScript')
  expect(result.stdout).toContain('Snapshots  1 written')
  expect(result.stdout).toContain('Test Files  1 passed')
})
