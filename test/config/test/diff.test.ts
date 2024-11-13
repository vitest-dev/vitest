import { stripVTControlCharacters } from 'node:util'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('diff', async () => {
  const { ctx } = await runVitest({
    root: './fixtures/diff',
  })
  const errors = ctx!.state.getFiles().flatMap(f =>
    f.tasks.flatMap(t => t.result?.errors ?? []),
  )
  expect(
    errors.map(e => e.diff && stripVTControlCharacters(e.diff)),
  ).matchSnapshot()
})
