import fs from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('jest-image-snapshot', async () => {
  // cleanup snapshot
  const root = join(import.meta.dirname, 'fixtures/jest-image-snapshot')
  fs.rmSync(join(root, '__image_snapshots__'), { recursive: true, force: true })

  // write snapshot
  let vitest = await runVitest({
    root,
    update: true,
  })
  expect(vitest.stderr).toBe('')
  expect(vitest.ctx?.snapshot.summary).toMatchInlineSnapshot(`
    Object {
      "added": 1,
      "didUpdate": true,
      "failure": false,
      "filesAdded": 1,
      "filesRemoved": 0,
      "filesRemovedList": Array [],
      "filesUnmatched": 0,
      "filesUpdated": 0,
      "matched": 0,
      "total": 1,
      "unchecked": 0,
      "uncheckedKeysByFile": Array [],
      "unmatched": 0,
      "updated": 0,
    }
  `)
  expect(fs.existsSync(join(root, '__image_snapshots__/basic-test-ts-to-match-image-snapshot-1-snap.png'))).toBe(true)

  // match existing snapshot
  vitest = await runVitest({
    root,
    update: false,
  })
  expect(vitest.stderr).toBe('')
  expect(vitest.ctx?.snapshot.summary).toMatchInlineSnapshot(`
    Object {
      "added": 0,
      "didUpdate": false,
      "failure": false,
      "filesAdded": 0,
      "filesRemoved": 0,
      "filesRemovedList": Array [],
      "filesUnmatched": 0,
      "filesUpdated": 0,
      "matched": 1,
      "total": 1,
      "unchecked": 0,
      "uncheckedKeysByFile": Array [],
      "unmatched": 0,
      "updated": 0,
    }
  `)
  expect(fs.existsSync(join(root, '__image_snapshots__/basic-test-ts-to-match-image-snapshot-1-snap.png'))).toBe(true)
})
