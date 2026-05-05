import { stripVTControlCharacters } from 'node:util'
import { expect, test } from 'vitest'
import { runInlineTests, runVitest } from '../../test-utils'

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

test('expected and actual reuse the asymmetric-matcher-aware stringification from the diff', async () => {
  const { ctx } = await runInlineTests({
    'basic.test.ts': `
      import { expect, test } from 'vitest'

      test('asymmetric matchers', () => {
        const actual = [
          { x: 1, y: 2, z: 3 },
          { x: 3, y: 1, z: 2 },
          { x: 2, y: 3, z: 1 },
          "wrong",
        ];

        expect(actual).toEqual([
          expect.objectContaining({ x: 1 }),
          expect.objectContaining({ z: 2 }),
          expect.objectContaining({ y: 3 }),
        ]);
      })
    `,
  })
  const errors = ctx!.state.getFiles().flatMap(f =>
    f.tasks.flatMap(t => t.result?.errors ?? []),
  )
  expect(errors).toHaveLength(1)
  const [error] = errors
  expect(stripVTControlCharacters(error.diff!)).toMatchInlineSnapshot(`
    "- Expected
    + Received

    @@ -12,6 +12,7 @@
        {
          "x": 2,
          "y": 3,
          "z": 1,
        },
    +   "wrong",
      ]"
  `)
  expect(error.expected).toMatchInlineSnapshot(`
    "[
      {
        "x": 1,
        "y": 2,
        "z": 3,
      },
      {
        "x": 3,
        "y": 1,
        "z": 2,
      },
      {
        "x": 2,
        "y": 3,
        "z": 1,
      },
    ]"
  `)
  expect(error.actual).toMatchInlineSnapshot(`
    "[
      {
        "x": 1,
        "y": 2,
        "z": 3,
      },
      {
        "x": 3,
        "y": 1,
        "z": 2,
      },
      {
        "x": 2,
        "y": 3,
        "z": 1,
      },
      "wrong",
    ]"
  `)
})
