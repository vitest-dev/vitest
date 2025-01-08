import fs from 'node:fs'
import { join } from 'node:path'
import { assert, expect, onTestFailed, onTestFinished, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

function fsUpdate(file: string, updateFn: (data: string) => string) {
  fs.writeFileSync(file, updateFn(fs.readFileSync(file, 'utf-8')))
}

test('summary', async () => {
  // cleanup snapshot
  const dir = join(import.meta.dirname, 'fixtures/summary')
  const testFile = join(dir, 'basic.test.ts')
  const snapshotFile = join(dir, '__snapshots__/basic.test.ts.snap')
  fsUpdate(testFile, s => s.replace(/`"@SNAP\d"`/g, ''))
  fs.rmSync(snapshotFile, { recursive: true, force: true })

  // write everything
  let vitest = await runVitest({
    root: 'test/fixtures/summary',
    update: true,
  })
  expect(vitest.stdout).toContain('Snapshots  12 written')

  // write partially
  fsUpdate(testFile, s => s.replace('`"@SNAP2"`', ''))
  fsUpdate(snapshotFile, s => s.replace('exports[`file repeats 1`] = `"@SNAP5"`;', ''))
  vitest = await runVitest({
    root: 'test/fixtures/summary',
    update: true,
  })
  expect(vitest.stdout).toContain('Snapshots  2 written')

  // update partially
  fsUpdate(testFile, s => s.replace('`"@SNAP2"`', '`"@WRONG"`'))
  fsUpdate(snapshotFile, s => s.replace('`"@SNAP5"`', '`"@WRONG"`'))
  vitest = await runVitest({
    root: 'test/fixtures/summary',
    update: true,
  })
  expect(vitest.stdout).toContain('Snapshots  2 updated')
})

test('first obsolete then remove', async () => {
  const root = join(import.meta.dirname, 'fixtures/summary-removed')
  const testFile = join(root, 'basic.test.ts')
  const snapshotFile = join(root, '__snapshots__/basic.test.ts.snap')

  // reset snapshot
  fs.rmSync(snapshotFile, { recursive: true, force: true })
  await runVitest({
    root,
    update: true,
  })
  expect(fs.readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`x 1\`] = \`0\`;

    exports[\`y 1\`] = \`0\`;
    "
  `)

  // watch run
  const { ctx, ...result } = await runVitest(
    {
      watch: true,
      root,
    },
  )
  assert(ctx)
  onTestFinished(() => {
    ctx.close()
  })
  onTestFailed(() => {
    console.error(result.vitest.stdout)
    console.error(result.vitest.stderr)
  })

  // remove `toMatchSnapshot()` and rerun -> obsolete snapshot
  editFile(testFile, s => s.replace(/REMOVE-START.*REMOVE-END/s, ''))
  await result.vitest.waitForStdout('1 obsolete')

  // rerun with update -> remove snapshot
  await ctx.updateSnapshot()
  await result.vitest.waitForStdout('1 removed')
  expect(fs.readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`x 1\`] = \`0\`;
    "
  `)
})
