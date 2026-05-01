import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'pathe'
import { afterEach, expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

const testFileName = resolve(import.meta.dirname, './fixtures/custom-snapshot-environment/test/snapshots.test.ts')
const snapshotFile = resolve(dirname(testFileName), './__snapshots__/snapshots.test.ts.snap')
const testFile = readFileSync(testFileName, 'utf-8')

afterEach(() => {
  writeFileSync(testFileName, testFile)
  rmSync(snapshotFile)
})

test('custom environment resolved correctly', async () => {
  const { stdout, stderr } = await runVitest({
    root: resolve(import.meta.dirname, './fixtures/custom-snapshot-environment'),
    update: true,
  })

  const snapshotLogs = stdout.split('\n').filter(i => i.startsWith('## ')).join('\n')
  expect(stderr).toBe('')
  expect(snapshotLogs).toMatchInlineSnapshot(`
    "## resolvePath snapshots/fixtures/custom-snapshot-environment/test/snapshots.test.ts
    ## readSnapshotFile snapshots/fixtures/custom-snapshot-environment/test/__snapshots__/snapshots.test.ts.snap
    ## getHeader
    ## getVersion
    ## readSnapshotFile snapshots/fixtures/custom-snapshot-environment/test/__snapshots__/snapshots.test.ts.snap
    ## saveSnapshotFile snapshots/fixtures/custom-snapshot-environment/test/__snapshots__/snapshots.test.ts.snap
    ## readSnapshotFile snapshots/fixtures/custom-snapshot-environment/test/snapshots.test.ts
    ## saveSnapshotFile snapshots/fixtures/custom-snapshot-environment/test/snapshots.test.ts"
  `)
})
