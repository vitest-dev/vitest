import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import { runInlineTests, runVitest } from '../../test-utils'

test('snapshots in skipped test/suite is not obsolete', async () => {
  // create snapshot on first run
  const root = path.join(import.meta.dirname, 'fixtures/skip-test')

  fs.rmSync(path.join(root, '__snapshots__'), { recursive: true, force: true })
  let vitest = await runVitest({
    root,
    update: true,
  })
  expect(vitest.stdout).toContain('Snapshots  2 written')
  expect(fs.readFileSync(path.join(root, '__snapshots__/repro.test.ts.snap'), 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`repro suite > inner case 1\`] = \`"hi-1"\`;

    exports[\`top-level case 1\`] = \`"hi-2"\`;
    "
  `)

  // running with `skipIf` enabled should not show "obsolete"
  vitest = await runVitest({
    root,
    env: {
      ENABLE_SKIP: '1',
    },
  })
  expect(vitest.stdout).toContain('2 skipped')
  expect(vitest.stdout).not.toContain('obsolete')

  // running with `skipIf` and `update` should keep snapshots
  vitest = await runVitest({
    root,
    update: true,
    env: {
      ENABLE_SKIP: '1',
    },
  })
  expect(fs.readFileSync(path.join(root, '__snapshots__/repro.test.ts.snap'), 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`repro suite > inner case 1\`] = \`"hi-1"\`;

    exports[\`top-level case 1\`] = \`"hi-2"\`;
    "
  `)
})

test('handle obsoleteness of toMatchSnapshot("custom message")', async () => {
  const root = path.join(import.meta.dirname, './fixtures/skip-test-custom')

  // clear snapshots
  fs.rmSync(path.join(root, '__snapshots__'), { recursive: true, force: true })

  // create snapshot on first run
  let vitest = await runVitest({
    root,
    update: true,
  })
  expect(vitest.stdout).toContain('Snapshots  4 written')
  expect(fs.readFileSync(path.join(root, '__snapshots__/basic.test.ts.snap'), 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`custom a > x 1\`] = \`0\`;

    exports[\`custom a > y 1\`] = \`0\`;

    exports[\`custom b > w 1\`] = \`0\`;

    exports[\`custom b > z 1\`] = \`0\`;
    "
  `)

  // Skipped tests' `toMatchSnapshot("...")` is not considered obsolete
  vitest = await runVitest({
    root,
    testNamePattern: 'custom a',
  })
  expect(vitest.stdout).toContain('1 passed')
  expect(vitest.stdout).toContain('1 skipped')
  expect(vitest.stdout).not.toContain('obsolete')

  vitest = await runVitest({
    root,
    testNamePattern: 'custom b',
  })
  expect(vitest.stdout).toContain('1 passed')
  expect(vitest.stdout).toContain('1 skipped')
  expect(vitest.stdout).not.toContain('obsolete')

  // check snapshot doesn't change when skip + update
  vitest = await runVitest({
    root,
    update: true,
    testNamePattern: 'custom a',
  })
  expect(vitest.stdout).toContain('1 passed')
  expect(vitest.stdout).toContain('1 skipped')
  expect(vitest.stdout).not.toContain('obsolete')
  expect(fs.readFileSync(path.join(root, '__snapshots__/basic.test.ts.snap'), 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`custom a > x 1\`] = \`0\`;

    exports[\`custom a > y 1\`] = \`0\`;

    exports[\`custom b > w 1\`] = \`0\`;

    exports[\`custom b > z 1\`] = \`0\`;
    "
  `)
})

test('obsolete snapshots are still reported when another test is skipped', async () => {
  const structure = {
    'basic.test.ts': `
      import { expect, it } from 'vitest'

      it.skip('a', () => {
        expect(0).toMatchSnapshot()
      })

      it('b', () => {
        expect(1).toMatchSnapshot()
      })
    `,
    '__snapshots__/basic.test.ts.snap': `// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

exports[\`a 1\`] = \`0\`;

exports[\`b 1\`] = \`1\`;

exports[\`removed test 1\`] = \`2\`;
`,
  }

  const failed = await runInlineTests(structure, { update: 'none' })
  expect(failed.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "__module_errors__": [
          "Obsolete snapshots found when no snapshot update is expected.
    · removed test 1
    ",
        ],
        "a": "skipped",
        "b": "passed",
      },
    }
  `)

  const updated = await runInlineTests(structure, { update: true })
  expect(fs.readFileSync(path.join(updated.root, '__snapshots__/basic.test.ts.snap'), 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`a 1\`] = \`0\`;

    exports[\`b 1\`] = \`1\`;
    "
  `)
})

test('skipped test does not hide obsolete snapshots of a test with a longer name', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
      import { expect, it } from 'vitest'

      it.skip('foo', () => {
        expect(0).toMatchSnapshot()
        expect(0).toMatchSnapshot('custom')
      })

      it('bar', () => {
        expect(1).toMatchSnapshot()
      })
    `,
    '__snapshots__/basic.test.ts.snap': `// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

exports[\`bar 1\`] = \`1\`;

exports[\`foo 1\`] = \`0\`;

exports[\`foo > custom 1\`] = \`0\`;

exports[\`foobar 1\`] = \`0\`;
`,
  }, { update: 'none' })
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "__module_errors__": [
          "Obsolete snapshots found when no snapshot update is expected.
    · foobar 1
    ",
        ],
        "bar": "passed",
        "foo": "skipped",
      },
    }
  `)
})
