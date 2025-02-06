import { stripVTControlCharacters } from 'node:util'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test.for([
  [undefined],
  [{ expand: false, printBasicPrototype: true }],
])(`inline diff options: %o`, async ([options]) => {
  const { ctx } = await runVitest({
    root: './fixtures/diff',
    diff: options,
  })
  const errors = ctx!.state.getFiles().flatMap(f =>
    f.tasks.flatMap(t => t.result?.errors ?? []),
  )
  expect(
    errors.map(e => e.diff && stripVTControlCharacters(e.diff)),
  ).matchSnapshot()
})
