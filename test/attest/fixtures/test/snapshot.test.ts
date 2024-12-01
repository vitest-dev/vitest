import { expect, test } from 'vitest'

test('inline snapshot', () => {
  expect(1 + 2).toMatchTypeInlineSnapshot(`number`)
  expect((1 + 2).toFixed).toMatchTypeInlineSnapshot(
    `(fractionDigits?: number | undefined) => string`,
  )
})

test('file snapshot', () => {
  expect(1 + 2).toMatchTypeSnapshot()
  expect((1 + 2).toPrecision).toMatchTypeSnapshot()
})

test('type error', () => {
  expect(() =>
    // @ts-expect-error test
    '1' / 2,
  ).toMatchTypeErrorInlineSnapshot(
    `The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.`,
  )

  expect(() =>
    // @ts-expect-error test
    '1' / 2,
  ).toMatchTypeErrorSnapshot()
})

test('completions', () => {
  expect(
    () =>
      // @ts-expect-error test
      // eslint-disable-next-line dot-notation
      (1 + 2)['to'],
  ).toMatchTypeCompletionInlineSnapshot(`
    {
      "to": [
        "toExponential",
        "toFixed",
        "toLocaleString",
        "toPrecision",
        "toString",
      ],
    }
  `)

  expect(
    () =>
      // @ts-expect-error test
      // eslint-disable-next-line dot-notation
      (1 + 2)['to'],
  ).toMatchTypeCompletionSnapshot()
})
