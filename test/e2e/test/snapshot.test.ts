import { expect, test } from 'vitest'
import { runInlineTests, runVitest } from '../../test-utils'

test('resolveSnapshotPath context', async () => {
  const { stderr, ctx } = await runVitest({
    root: './fixtures/snapshot-path-context',
  })
  expect(stderr).toBe('')
  expect(
    Object.fromEntries(
      ctx!.state.getFiles().map(f => [`${f.projectName}|${f.name}`, f.result?.state]),
    ),
  ).toMatchInlineSnapshot(`
    {
      "project1|basic.test.ts": "pass",
      "project2|basic.test.ts": "pass",
    }
  `)
})

// https://github.com/vitest-dev/vitest/issues/8655
test('toMatchFileSnapshot targeting the default snapshot path is not deleted', async () => {
  const { fs, root, exitCode } = await runInlineTests({
    'src/basic.test.ts': `
import { expect, it } from 'vitest'

it('collides with the default snapshot path', async () => {
  await expect('foobar').toMatchFileSnapshot('__snapshots__/basic.test.ts.snap')
})
`,
  }, { update: true })
  expect(exitCode).toBe(0)
  expect(fs.readFile('src/__snapshots__/basic.test.ts.snap')).toBe('foobar')

  // the file matches on the second run, so there is nothing to write and
  // it used to be removed as if it were an obsolete snapshot file
  const second = await runVitest({ root, update: true })
  expect(second.exitCode).toBe(0)
  expect(fs.readFile('src/__snapshots__/basic.test.ts.snap')).toBe('foobar')
})
