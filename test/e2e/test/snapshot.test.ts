import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

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
