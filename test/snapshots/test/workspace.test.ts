import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

test('--update works for workspace project', async () => {
  // setup wrong snapshot value
  const snapshotPath = 'test/fixtures/workspace/packages/space/test/__snapshots__/basic.test.ts.snap'
  editFile(snapshotPath, data => data.replace('`1`', '`2`'))

  // run with --update
  const { stdout, exitCode } = await runVitest({
    update: true,
    root: 'test/fixtures/workspace',
  })
  expect(stdout).include('Snapshots  1 updated')
  expect(exitCode).toBe(0)
})
