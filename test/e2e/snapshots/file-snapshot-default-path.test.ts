import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

// https://github.com/vitest-dev/vitest/issues/8655
test('toMatchFileSnapshot is not deleted when it targets the default snapshot path', async () => {
  const root = path.join(import.meta.dirname, 'fixtures/file-snapshot-default-path')
  const snapshotFile = path.join(root, 'src/__snapshots__/repro.test.ts.snap')

  // cleanup
  fs.rmSync(path.join(root, 'src/__snapshots__'), { recursive: true, force: true })

  // first run creates the file snapshot (file did not exist yet)
  let result = await runVitest({ root, update: true })
  expect(result.stderr).toBe('')
  expect(fs.existsSync(snapshotFile)).toBe(true)

  // second run: the file already exists. It must NOT be deleted as if it were
  // an obsolete `toMatchSnapshot` external snapshot file.
  result = await runVitest({ root, update: true })
  expect(result.stderr).toBe('')
  expect(fs.existsSync(snapshotFile)).toBe(true)
})
