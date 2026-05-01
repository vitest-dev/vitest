import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'
import { readInlineSnapshots } from './utils'

test('it should pass', async () => {
  const { stdout, stderr } = await runVitest({
    root: 'test/fixtures/custom-serializers',
  })

  expect(stdout).toContain('✓ custom-serializers.test.ts')
  expect(stderr).toBe('')
})

test('empty serializer output', async () => {
  const root = path.join(import.meta.dirname, 'fixtures/custom-serializers-empty')
  const testFile = path.join(root, 'basic.test.ts')
  const snapshotFile = path.join(root, '__snapshots__/basic.test.ts.snap')

  // clean slate
  fs.rmSync(path.join(root, '__snapshots__'), { recursive: true, force: true })
  editFile(testFile, s => s
    .replace(/toMatchInlineSnapshot\(`[^`]*`/g, 'toMatchInlineSnapshot('))

  let result = await runVitest({
    root,
    update: 'all',
  })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "file empty": "passed",
        "file whitespaces": "passed",
        "inline empty": "passed",
        "inline whitespaces": "passed",
      },
    }
  `)
  expect(fs.readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`file empty 1\`] = \`\`;

    exports[\`file whitespaces 1\`] = \`    \`;
    "
  `)
  expect(readInlineSnapshots(testFile)).toMatchInlineSnapshot(`
    "
    expect({ __unwrap__: "" }).toMatchInlineSnapshot(\`\`)

    expect({ __unwrap__: " ".repeat(4) }).toMatchInlineSnapshot(\`\`)
    "
  `)

  result = await runVitest({
    root,
    update: 'none',
  })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "file empty": "passed",
        "file whitespaces": "passed",
        "inline empty": "passed",
        "inline whitespaces": "passed",
      },
    }
  `)

  // TODO: snapshot comparison normalizes whitespaces. probably hard to fix.
  editFile(testFile, s => s
    .replace(`__unwrap__: " ".repeat(4)`, `__unwrap__: " ".repeat(8)`))
  result = await runVitest({
    root,
    update: 'none',
  })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "file empty": "passed",
        "file whitespaces": "passed",
        "inline empty": "passed",
        "inline whitespaces": "passed",
      },
    }
  `)
  expect(fs.readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`file empty 1\`] = \`\`;

    exports[\`file whitespaces 1\`] = \`    \`;
    "
  `)
  expect(readInlineSnapshots(testFile)).toMatchInlineSnapshot(`
    "
    expect({ __unwrap__: "" }).toMatchInlineSnapshot(\`\`)

    expect({ __unwrap__: " ".repeat(4) }).toMatchInlineSnapshot(\`\`)
    "
  `)

  result = await runVitest({
    root,
    update: 'all',
  })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "file empty": "passed",
        "file whitespaces": "passed",
        "inline empty": "passed",
        "inline whitespaces": "passed",
      },
    }
  `)
  expect(fs.readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`file empty 1\`] = \`\`;

    exports[\`file whitespaces 1\`] = \`        \`;
    "
  `)
  expect(readInlineSnapshots(testFile)).toMatchInlineSnapshot(`
    "
    expect({ __unwrap__: "" }).toMatchInlineSnapshot(\`\`)

    expect({ __unwrap__: " ".repeat(4) }).toMatchInlineSnapshot(\`\`)
    "
  `)
})
