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

async function runFailingAssertion(body: string) {
  const { ctx } = await runInlineTests({
    'basic.test.ts': `
      import { expect, test } from 'vitest'
      test('case', () => { ${body} })
    `,
  })
  const errors = ctx!.state.getFiles().flatMap(f =>
    f.tasks.flatMap(t => t.result?.errors ?? []),
  )
  expect(errors).toHaveLength(1)
  const [error] = errors
  return {
    diff: stripVTControlCharacters(error.diff!),
    expected: error.expected,
    actual: error.actual,
  }
}

test('expected and actual reuse the asymmetric-matcher-aware stringification from the diff', async () => {
  const { diff, expected, actual } = await runFailingAssertion(`
    const value = [
      { x: 1, y: 2, z: 3 },
      { x: 3, y: 1, z: 2 },
      { x: 2, y: 3, z: 1 },
      "wrong",
    ];

    expect(value).toEqual([
      expect.objectContaining({ x: 1 }),
      expect.objectContaining({ z: 2 }),
      expect.objectContaining({ y: 3 }),
    ]);
  `)
  expect(diff).toMatchInlineSnapshot(`
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
  expect(expected).toMatchInlineSnapshot(`
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
  expect(actual).toMatchInlineSnapshot(`
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

test('numbers reuse the diff stringification', async () => {
  const { diff, expected, actual } = await runFailingAssertion(
    `expect(1).toEqual(2)`,
  )
  expect(diff).toMatchInlineSnapshot(`
    "- Expected
    + Received

    - 2
    + 1"
  `)
  expect(expected).toMatchInlineSnapshot(`"2"`)
  expect(actual).toMatchInlineSnapshot(`"1"`)
})

test('booleans reuse the diff stringification', async () => {
  const { diff, expected, actual } = await runFailingAssertion(
    `expect(false).toEqual(true)`,
  )
  expect(diff).toMatchInlineSnapshot(`
    "- Expected
    + Received

    - true
    + false"
  `)
  expect(expected).toMatchInlineSnapshot(`"true"`)
  expect(actual).toMatchInlineSnapshot(`"false"`)
})

test('multiline strings populate expected and actual', async () => {
  const { diff, expected, actual } = await runFailingAssertion(
    `expect("a\\nb\\nc").toEqual("a\\nB\\nc")`,
  )
  expect(diff).toMatchInlineSnapshot(`
    "- Expected
    + Received

      a
    - B
    + b
      c"
  `)
  expect(expected).toMatchInlineSnapshot(`
    "a
    B
    c"
  `)
  expect(actual).toMatchInlineSnapshot(`
    "a
    b
    c"
  `)
})

test('single-line strings populate expected and actual', async () => {
  const { diff, expected, actual } = await runFailingAssertion(
    `expect("foo").toEqual("bar")`,
  )
  expect(diff).toMatchInlineSnapshot(`
    "Expected: "bar"
    Received: "foo""
  `)
  expect(expected).toMatchInlineSnapshot(`"bar"`)
  expect(actual).toMatchInlineSnapshot(`"foo"`)
})

test('maps reuse the diff stringification', async () => {
  const { diff, expected, actual } = await runFailingAssertion(`
    const a = new Map([['x', 1], ['y', 2]])
    const b = new Map([['x', 1], ['y', 3]])
    expect(a).toEqual(b)
  `)
  expect(diff).toMatchInlineSnapshot(`
    "- Expected
    + Received

      Map {
        "x" => 1,
    -   "y" => 3,
    +   "y" => 2,
      }"
  `)
  expect(expected).toMatchInlineSnapshot(`
    "Map {
      "x" => 1,
      "y" => 3,
    }"
  `)
  expect(actual).toMatchInlineSnapshot(`
    "Map {
      "x" => 1,
      "y" => 2,
    }"
  `)
})

test('sets reuse the diff stringification', async () => {
  const { diff, expected, actual } = await runFailingAssertion(
    `expect(new Set([1, 2])).toEqual(new Set([1, 3]))`,
  )
  expect(diff).toMatchInlineSnapshot(`
    "- Expected
    + Received

      Set {
        1,
    -   3,
    +   2,
      }"
  `)
  expect(expected).toMatchInlineSnapshot(`
    "Set {
      1,
      3,
    }"
  `)
  expect(actual).toMatchInlineSnapshot(`
    "Set {
      1,
      2,
    }"
  `)
})

test('mismatched types reuse the diff stringification', async () => {
  const { diff, expected, actual } = await runFailingAssertion(
    `expect(1).toEqual("foo")`,
  )
  expect(diff).toMatchInlineSnapshot(`
    "- Expected:
    "foo"

    + Received:
    1"
  `)
  expect(expected).toMatchInlineSnapshot(`""foo""`)
  expect(actual).toMatchInlineSnapshot(`"1"`)
})
