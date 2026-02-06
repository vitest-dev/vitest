import fs, { readFileSync } from 'node:fs'
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

test('test.each/for', async () => {
  const root = join(import.meta.dirname, 'fixtures/inline-multiple-calls')
  const testFile = join(root, 'each.test.ts')

  // remove inline snapshots
  editFile(testFile, s => s
    .replace(/toMatchInlineSnapshot\(`[^`]*`\)/g, 'toMatchInlineSnapshot()')
    .replace(/toThrowErrorMatchingInlineSnapshot\(`[^`]*`\)/g, 'toThrowErrorMatchingInlineSnapshot()'))

  // create snapshots from scratch
  let result = await runVitest({ root, include: [testFile], update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(readFileSync(testFile, 'utf-8')).toMatchInlineSnapshot(`
    "import { expect, test, describe } from "vitest";

    test.for(["hello", "world"])("test %s", (arg) => {
      expect(arg.length).toMatchInlineSnapshot(\`5\`);
    });

    describe.for(["hello", "world"])("suite %s", (arg) => {
      test("length", () => {
        expect(arg.length).toMatchInlineSnapshot(\`5\`);
      });
    });

    test.for(["hello", "world"])("toThrowErrorMatchingInlineSnapshot %s", (arg) => {
      expect(() => {
        throw new Error(\`length = \${arg.length}\`);
      }).toThrowErrorMatchingInlineSnapshot(\`[Error: length = 5]\`)
    });
    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "each.test.ts": Object {
        "suite hello": Object {
          "length": "passed",
        },
        "suite world": Object {
          "length": "passed",
        },
        "test hello": "passed",
        "test world": "passed",
        "toThrowErrorMatchingInlineSnapshot hello": "passed",
        "toThrowErrorMatchingInlineSnapshot world": "passed",
      },
    }
  `)
  expect(result.ctx?.snapshot.summary).toMatchInlineSnapshot(`
    Object {
      "added": 6,
      "didUpdate": false,
      "failure": false,
      "filesAdded": 1,
      "filesRemoved": 0,
      "filesRemovedList": Array [],
      "filesUnmatched": 0,
      "filesUpdated": 0,
      "matched": 0,
      "total": 6,
      "unchecked": 0,
      "uncheckedKeysByFile": Array [],
      "unmatched": 0,
      "updated": 0,
    }
  `)

  // edit tests to introduce errors
  editFile(testFile, s => s.replaceAll(`"hello"`, `"hey"`))

  // fails with update=false
  result = await runVitest({ root, include: [testFile], update: false })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  each.test.ts > test hey
    Error: Snapshot \`test hey 1\` mismatched

    Expected: "5"
    Received: "3"

     ❯ each.test.ts:4:22
          2|
          3| test.for(["hey", "world"])("test %s", (arg) => {
          4|   expect(arg.length).toMatchInlineSnapshot(\`5\`);
           |                      ^
          5| });
          6|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯

     FAIL  each.test.ts > test world
    Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

    Expected: "3"
    Received: "5"

     ❯ each.test.ts:4:22
          2|
          3| test.for(["hey", "world"])("test %s", (arg) => {
          4|   expect(arg.length).toMatchInlineSnapshot(\`5\`);
           |                      ^
          5| });
          6|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯

     FAIL  each.test.ts > suite hey > length
    Error: Snapshot \`suite hey > length 1\` mismatched

    Expected: "5"
    Received: "3"

     ❯ each.test.ts:9:24
          7| describe.for(["hey", "world"])("suite %s", (arg) => {
          8|   test("length", () => {
          9|     expect(arg.length).toMatchInlineSnapshot(\`5\`);
           |                        ^
         10|   });
         11| });

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/6]⎯

     FAIL  each.test.ts > suite world > length
    Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

    Expected: "3"
    Received: "5"

     ❯ each.test.ts:9:24
          7| describe.for(["hey", "world"])("suite %s", (arg) => {
          8|   test("length", () => {
          9|     expect(arg.length).toMatchInlineSnapshot(\`5\`);
           |                        ^
         10|   });
         11| });

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯

     FAIL  each.test.ts > toThrowErrorMatchingInlineSnapshot hey
    Error: Snapshot \`toThrowErrorMatchingInlineSnapshot hey 1\` mismatched

    Expected: "[Error: length = 5]"
    Received: "[Error: length = 3]"

     ❯ each.test.ts:16:6
         14|   expect(() => {
         15|     throw new Error(\`length = \${arg.length}\`);
         16|   }).toThrowErrorMatchingInlineSnapshot(\`[Error: length = 5]\`)
           |      ^
         17| });
         18|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯

     FAIL  each.test.ts > toThrowErrorMatchingInlineSnapshot world
    Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

    Expected: "[Error: length = 3]"
    Received: "[Error: length = 5]"

     ❯ each.test.ts:16:6
         14|   expect(() => {
         15|     throw new Error(\`length = \${arg.length}\`);
         16|   }).toThrowErrorMatchingInlineSnapshot(\`[Error: length = 5]\`)
           |      ^
         17| });
         18|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "each.test.ts": Object {
        "suite hey": Object {
          "length": Array [
            "Snapshot \`suite hey > length 1\` mismatched",
          ],
        },
        "suite world": Object {
          "length": Array [
            "toMatchInlineSnapshot with different snapshots cannot be called at the same location",
          ],
        },
        "test hey": Array [
          "Snapshot \`test hey 1\` mismatched",
        ],
        "test world": Array [
          "toMatchInlineSnapshot with different snapshots cannot be called at the same location",
        ],
        "toThrowErrorMatchingInlineSnapshot hey": Array [
          "Snapshot \`toThrowErrorMatchingInlineSnapshot hey 1\` mismatched",
        ],
        "toThrowErrorMatchingInlineSnapshot world": Array [
          "toMatchInlineSnapshot with different snapshots cannot be called at the same location",
        ],
      },
    }
  `)
  expect(result.ctx?.snapshot.summary).toMatchInlineSnapshot(`
      Object {
        "added": 0,
        "didUpdate": false,
        "failure": false,
        "filesAdded": 0,
        "filesRemoved": 0,
        "filesRemovedList": Array [],
        "filesUnmatched": 1,
        "filesUpdated": 0,
        "matched": 0,
        "total": 3,
        "unchecked": 0,
        "uncheckedKeysByFile": Array [],
        "unmatched": 3,
        "updated": 0,
      }
    `)

  // fails with update=all
  result = await runVitest({ root, include: [testFile], update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  each.test.ts > test world
    Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

    Expected: "3"
    Received: "5"

     ❯ each.test.ts:4:22
          2|
          3| test.for(["hey", "world"])("test %s", (arg) => {
          4|   expect(arg.length).toMatchInlineSnapshot(\`5\`);
           |                      ^
          5| });
          6|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

     FAIL  each.test.ts > suite world > length
    Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

    Expected: "3"
    Received: "5"

     ❯ each.test.ts:9:24
          7| describe.for(["hey", "world"])("suite %s", (arg) => {
          8|   test("length", () => {
          9|     expect(arg.length).toMatchInlineSnapshot(\`5\`);
           |                        ^
         10|   });
         11| });

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

     FAIL  each.test.ts > toThrowErrorMatchingInlineSnapshot world
    Error: toMatchInlineSnapshot with different snapshots cannot be called at the same location

    Expected: "[Error: length = 3]"
    Received: "[Error: length = 5]"

     ❯ each.test.ts:16:6
         14|   expect(() => {
         15|     throw new Error(\`length = \${arg.length}\`);
         16|   }).toThrowErrorMatchingInlineSnapshot(\`[Error: length = 5]\`)
           |      ^
         17| });
         18|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "each.test.ts": Object {
        "suite hey": Object {
          "length": "passed",
        },
        "suite world": Object {
          "length": Array [
            "toMatchInlineSnapshot with different snapshots cannot be called at the same location",
          ],
        },
        "test hey": "passed",
        "test world": Array [
          "toMatchInlineSnapshot with different snapshots cannot be called at the same location",
        ],
        "toThrowErrorMatchingInlineSnapshot hey": "passed",
        "toThrowErrorMatchingInlineSnapshot world": Array [
          "toMatchInlineSnapshot with different snapshots cannot be called at the same location",
        ],
      },
    }
  `)
  expect(readFileSync(testFile, 'utf-8')).toMatchInlineSnapshot(`
    "import { expect, test, describe } from "vitest";

    test.for(["hey", "world"])("test %s", (arg) => {
      expect(arg.length).toMatchInlineSnapshot(\`5\`);
    });

    describe.for(["hey", "world"])("suite %s", (arg) => {
      test("length", () => {
        expect(arg.length).toMatchInlineSnapshot(\`5\`);
      });
    });

    test.for(["hey", "world"])("toThrowErrorMatchingInlineSnapshot %s", (arg) => {
      expect(() => {
        throw new Error(\`length = \${arg.length}\`);
      }).toThrowErrorMatchingInlineSnapshot(\`[Error: length = 5]\`)
    });
    "
  `)
  expect(result.ctx?.snapshot.summary).toMatchInlineSnapshot(`
      Object {
        "added": 0,
        "didUpdate": true,
        "failure": false,
        "filesAdded": 0,
        "filesRemoved": 0,
        "filesRemovedList": Array [],
        "filesUnmatched": 0,
        "filesUpdated": 1,
        "matched": 0,
        "total": 3,
        "unchecked": 0,
        "uncheckedKeysByFile": Array [],
        "unmatched": 0,
        "updated": 3,
      }
    `)
})
