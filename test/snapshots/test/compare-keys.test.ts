import fs from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('compareKeys', async () => {
  const root = join(import.meta.dirname, 'fixtures/compare-keys')
  fs.rmSync(join(root, '__snapshots__'), { recursive: true, force: true })

  // compareKeys null
  let vitest = await runVitest({
    root,
    update: true,
    snapshotFormat: {
      compareKeys: null,
    },
  })
  expect(vitest.stderr).toBe('')
  expect(fs.readFileSync(join(root, '__snapshots__/basic.test.ts.snap'), 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`compareKeys 1\`] = \`
    {
      "a": 1,
      "b": 2,
      "c": 3,
    }
    \`;

    exports[\`compareKeys 2\`] = \`
    {
      "c": 1,
      "b": 2,
      "a": 3,
    }
    \`;

    exports[\`compareKeys 3\`] = \`
    {
      "b": 1,
      "a": 2,
      "c": 3,
    }
    \`;
    "
  `)

  // compareKeys undefined
  vitest = await runVitest({
    root,
    update: true,
    snapshotFormat: {
      compareKeys: undefined,
    },
  })
  expect(vitest.stderr).toBe('')
  expect(fs.readFileSync(join(root, '__snapshots__/basic.test.ts.snap'), 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`compareKeys 1\`] = \`
    {
      "a": 1,
      "b": 2,
      "c": 3,
    }
    \`;

    exports[\`compareKeys 2\`] = \`
    {
      "a": 3,
      "b": 2,
      "c": 1,
    }
    \`;

    exports[\`compareKeys 3\`] = \`
    {
      "a": 2,
      "b": 1,
      "c": 3,
    }
    \`;
    "
  `)
})
