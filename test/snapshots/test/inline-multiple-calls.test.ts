import fs from 'node:fs'
import { join } from 'pathe'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

// pnpm -C test/snapshots test:snaps inline-multiple-calls

test('same snapshots in single test', async () => {
  // pnpm -C test/snapshots test:fixtures --root test/fixtures/inline-multiple-calls same.test

  // reset snapshot
  const root = join(import.meta.dirname, 'fixtures/inline-multiple-calls')
  const testFile = join(root, 'same.test.ts')
  editFile(testFile, s => s.replace(/toMatchInlineSnapshot\(`.*`\)/gs, 'toMatchInlineSnapshot()'))

  // initial run (create snapshot)
  let vitest = await runVitest({
    root,
    include: [testFile],
    update: true,
  })
  expect(vitest.stderr).toBe('')
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
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot(`"test1"`)')

  // no-update run
  vitest = await runVitest({
    root,
    include: [testFile],
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
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot(`"test1"`)')

  // update run
  vitest = await runVitest({
    root,
    include: [testFile],
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
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot(`"test1"`)')
})

test('same snapshots in multiple tests', async () => {
  // pnpm -C test/snapshots test:fixtures --root test/fixtures/inline-multiple-calls same2.test

  // reset snapshot
  const root = join(import.meta.dirname, 'fixtures/inline-multiple-calls')
  const testFile = join(root, 'same2.test.ts')
  editFile(testFile, s => s.replace(/toMatchInlineSnapshot\(`.*`\)/gs, 'toMatchInlineSnapshot()'))

  // initial run (create snapshot)
  let vitest = await runVitest({
    root,
    include: [testFile],
    update: true,
  })
  expect(vitest.stderr).toBe('')
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
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot(`"test1"`)')

  // no-update run
  vitest = await runVitest({
    root,
    include: [testFile],
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
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot(`"test1"`)')

  // update run
  vitest = await runVitest({
    root,
    include: [testFile],
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
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot(`"test1"`)')
})

test('different snapshots in single test', async () => {
  // pnpm -C test/snapshots test:fixtures --root test/fixtures/inline-multiple-calls different.test

  // reset snapshot
  const root = join(import.meta.dirname, 'fixtures/inline-multiple-calls')
  const testFile = join(root, 'different.test.ts')
  editFile(testFile, s => s.replace(/toMatchInlineSnapshot\(`.*`\)/gs, 'toMatchInlineSnapshot()'))

  // update run should fail
  let vitest = await runVitest({
    root,
    include: [testFile],
    update: true,
  })
  expect(vitest.stderr).toContain(`
Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

Expected: ""test1""
Received: ""test2""
`)
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot()')
  expect(vitest.exitCode).not.toBe(0)

  // no-update run should fail
  vitest = await runVitest({
    root,
    include: [testFile],
    update: false,
  })
  if (process.env.CI) {
    expect(vitest.stderr).toContain(`
Error: Snapshot \`single 1\` mismatched
`)
  }
  else {
    expect(vitest.stderr).toContain(`
Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

Expected: ""test1""
Received: ""test2""
`)
  }
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot()')

  // current snapshot is "test1"
  editFile(testFile, s => s.replace('expect(value).toMatchInlineSnapshot()', 'expect(value).toMatchInlineSnapshot(`"test1"`)'))
  vitest = await runVitest({
    root,
    include: [testFile],
    update: true,
  })
  expect(vitest.stderr).toContain(`
Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

Expected: ""test1""
Received: ""test2""
`)
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot(`"test1"`)')

  vitest = await runVitest({
    root,
    include: [testFile],
    update: false,
  })
  expect(vitest.stderr).toContain(`
Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

Expected: ""test1""
Received: ""test2""
`)
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot(`"test1"`)')

  // current snapshot is "test2"
  editFile(testFile, s => s.replace('expect(value).toMatchInlineSnapshot(`"test1"`)', 'expect(value).toMatchInlineSnapshot(`"test2"`)'))
  vitest = await runVitest({
    root,
    include: [testFile],
    update: true,
  })
  expect(vitest.stderr).toContain(`
Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

Expected: ""test1""
Received: ""test2""
`)
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot(`"test2"`)')

  vitest = await runVitest({
    root,
    include: [testFile],
    update: false,
  })
  expect(vitest.stderr).toContain(`
Error: Snapshot \`single 1\` mismatched

Expected: ""test2""
Received: ""test1""
`)
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot(`"test2"`)')
})

test('different snapshots in multiple tests', async () => {
  // pnpm -C test/snapshots test:fixtures --root test/fixtures/inline-multiple-calls different2.test

  // reset snapshot
  const root = join(import.meta.dirname, 'fixtures/inline-multiple-calls')
  const testFile = join(root, 'different2.test.ts')
  editFile(testFile, s => s.replace(/toMatchInlineSnapshot\(`.*`\)/gs, 'toMatchInlineSnapshot()'))

  // update run should fail
  let vitest = await runVitest({
    root,
    include: [testFile],
    update: true,
  })
  expect(vitest.stderr).toContain(`
Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

Expected: ""test1""
Received: ""test2""
`)
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot()')
  expect(vitest.exitCode).not.toBe(0)

  // no-update run should fail
  vitest = await runVitest({
    root,
    include: [testFile],
    update: false,
  })
  if (process.env.CI) {
    expect(vitest.stderr).toContain(`
Error: Snapshot \`a 1\` mismatched
`)
  }
  else {
    expect(vitest.stderr).toContain(`
Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

Expected: ""test1""
Received: ""test2""
`)
  }
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot()')

  // current snapshot is "test1"
  editFile(testFile, s => s.replace('expect(value).toMatchInlineSnapshot()', 'expect(value).toMatchInlineSnapshot(`"test1"`)'))
  vitest = await runVitest({
    root,
    include: [testFile],
    update: true,
  })
  expect(vitest.stderr).toContain(`
Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

Expected: ""test1""
Received: ""test2""
`)
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot(`"test1"`)')

  vitest = await runVitest({
    root,
    include: [testFile],
    update: false,
  })
  expect(vitest.stderr).toContain(`
Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

Expected: ""test1""
Received: ""test2""
`)
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot(`"test1"`)')

  // current snapshot is "test2"
  editFile(testFile, s => s.replace('expect(value).toMatchInlineSnapshot(`"test1"`)', 'expect(value).toMatchInlineSnapshot(`"test2"`)'))
  vitest = await runVitest({
    root,
    include: [testFile],
    update: true,
  })
  expect(vitest.stderr).toContain(`
Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

Expected: ""test1""
Received: ""test2""
`)
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot(`"test2"`)')

  vitest = await runVitest({
    root,
    include: [testFile],
    update: false,
  })
  expect(vitest.stderr).toContain(`
Error: Snapshot \`a 1\` mismatched

Expected: ""test2""
Received: ""test1""
`)
  expect(fs.readFileSync(testFile, 'utf-8')).toContain('expect(value).toMatchInlineSnapshot(`"test2"`)')
})
