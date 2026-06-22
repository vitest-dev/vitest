import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'pathe'
import { afterEach, expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

const customRoot = resolve(import.meta.dirname, './fixtures/custom-snapshot-environment-data-reader')
const customSnapshotFile = resolve(customRoot, 'test/__snapshots__/snapshots.test.ts.snap')

const defaultRoot = resolve(import.meta.dirname, './fixtures/default-snapshot-environment-data-reader')
const defaultSnapshotFile = resolve(defaultRoot, 'test/__snapshots__/snapshots.test.ts.snap')

const corruptedRoot = resolve(import.meta.dirname, './fixtures/corrupted-snapshot-environment-data-reader')
const corruptedSnapshotFile = resolve(corruptedRoot, 'test/__snapshots__/snapshots.test.ts.snap')

afterEach(() => {
  rmSync(customSnapshotFile, { force: true })
  rmSync(defaultSnapshotFile, { force: true })
  rmSync(corruptedSnapshotFile, { force: true })
})

test('readSnapshotFileData is used instead of readSnapshotFile', async () => {
  // First run: create the snapshot file
  await runVitest({ root: customRoot, update: true })

  // Second run: file exists — readSnapshotFileData must parse it correctly
  const { stdout, stderr } = await runVitest({ root: customRoot })

  const logs = stdout.split('\n').filter(i => i.startsWith('## ')).map(i => `${i.split(' ')[0]} ${i.split(' ')[1]}`).join('\n')
  // No stderr means the existing snapshot was read and matched correctly
  expect(stderr).toBe('')
  expect(logs).toMatchInlineSnapshot(`"## readSnapshotFileData"`)
})

test('default readSnapshotFileData reads existing snapshots without overriding it', async () => {
  // First run: create the snapshot file with the default environment
  await runVitest({ root: defaultRoot, update: true })

  // Second run: file exists — the default readSnapshotFileData implementation
  // must parse it correctly so integrators that don't override it keep working
  const { stderr, exitCode } = await runVitest({ root: defaultRoot })

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})

test('a corrupted snapshot file produces a hard error', async () => {
  mkdirSync(dirname(corruptedSnapshotFile), { recursive: true })
  // not a valid snapshot file — evaluating it throws
  writeFileSync(corruptedSnapshotFile, 'this is not valid javascript {{{', 'utf-8')

  const { stderr } = await runVitest({ root: corruptedRoot })

  expect(stderr).toContain('Invalid snapshot file, please manually fix or delete it')
  expect(stderr).toContain(corruptedSnapshotFile)
})
