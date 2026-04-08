import { stripVTControlCharacters } from 'node:util'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test.for([
  [{ expand: true }],
  [{ printBasicPrototype: true }],
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

test('soft assertion with printBasicPrototype diff option', async () => {
  const { ctx } = await runVitest({
    root: './fixtures/diff',
    diff: { printBasicPrototype: true },
  }, ['soft-assertions.test.ts'])

  const errors = ctx!.state.getFiles().flatMap(f =>
    f.tasks.flatMap(t => t.result?.errors ?? []),
  )

  expect(errors.length).toBeGreaterThan(0)

  const diff = errors[0].diff && stripVTControlCharacters(errors[0].diff)
  expect(diff).toMatchInlineSnapshot(`
    "- Expected
    + Received

      Object {
        "arr": Array [
          1,
    -     3,
    +     2,
        ],
        "obj": Object {
    -     "k": "bar",
    +     "k": "foo",
        },
      }"
  `)
})
