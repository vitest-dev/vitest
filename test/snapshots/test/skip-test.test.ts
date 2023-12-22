import fs from 'node:fs'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('snapshots in skipped test/suite is not obsolete', async () => {
  // create snapshot on first run
  fs.rmSync('test/fixtures/skip-test/__snapshots__', { recursive: true, force: true })
  let vitest = await runVitest({
    root: 'test/fixtures/skip-test',
    update: true,
  })
  expect(vitest.stdout).toContain('Snapshots  2 written')
  expect(fs.readFileSync('test/fixtures/skip-test/__snapshots__/repro.test.ts.snap', 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`repro suite > inner case 1\`] = \`"hi-1"\`;

    exports[\`top-level case 1\`] = \`"hi-2"\`;
    "
  `)

  // running with `skipIf` enabled should not show "obsolete"
  vitest = await runVitest({
    root: 'test/fixtures/skip-test',
    env: {
      ENABLE_SKIP: '1',
    },
  })
  expect(vitest.stdout).toContain('2 skipped')
  expect(vitest.stdout).not.toContain('obsolete')

  // running with `skipIf` and `update` should keep snapshots
  vitest = await runVitest({
    root: 'test/fixtures/skip-test',
    update: true,
    env: {
      ENABLE_SKIP: '1',
    },
  })
  expect(fs.readFileSync('test/fixtures/skip-test/__snapshots__/repro.test.ts.snap', 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`repro suite > inner case 1\`] = \`"hi-1"\`;

    exports[\`top-level case 1\`] = \`"hi-2"\`;
    "
  `)
})
