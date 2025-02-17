import fs from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

// pnpm -C test/snapshots test:fixtures --root test/fixtures/inline-multiple-calls
// pnpm -C test/snapshots test:snaps inline-multiple-calls

test('workflow', async () => {
  // reset snapshot
  const root = join(import.meta.dirname, 'fixtures/inline-multiple-calls')
  const testFile = join(root, 'basic.test.ts')
  editFile(testFile, s => s.replace(/toMatchInlineSnapshot\(`.*`\)/gs, 'toMatchInlineSnapshot()'))

  // iniital run (create snapshot)
  let vitest = await runVitest({
    root,
    update: true,
  })
  expect(vitest.stderr).toBe('')
  // TODO: should summary have `added: 1`?
  expect(vitest.ctx?.snapshot.summary).toMatchInlineSnapshot(`
    Object {
      "added": 2,
      "didUpdate": true,
      "failure": false,
      "filesAdded": 1,
      "filesRemoved": 0,
      "filesRemovedList": Array [],
      "filesUnmatched": 0,
      "filesUpdated": 0,
      "matched": 0,
      "total": 2,
      "unchecked": 0,
      "uncheckedKeysByFile": Array [],
      "unmatched": 0,
      "updated": 0,
    }
  `)
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(test1).toMatchInlineSnapshot(`"test1"`)')

  // no-update run
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
      "matched": 2,
      "total": 2,
      "unchecked": 0,
      "uncheckedKeysByFile": Array [],
      "unmatched": 0,
      "updated": 0,
    }
  `)
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(test1).toMatchInlineSnapshot(`"test1"`)')

  // update run
  vitest = await runVitest({
    root,
    update: true,
  })
  expect(vitest.ctx?.snapshot.summary).toMatchInlineSnapshot(`
    Object {
      "added": 0,
      "didUpdate": true,
      "failure": false,
      "filesAdded": 0,
      "filesRemoved": 0,
      "filesRemovedList": Array [],
      "filesUnmatched": 0,
      "filesUpdated": 0,
      "matched": 2,
      "total": 2,
      "unchecked": 0,
      "uncheckedKeysByFile": Array [],
      "unmatched": 0,
      "updated": 0,
    }
  `)
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(test1).toMatchInlineSnapshot(`"test1"`)')
})
