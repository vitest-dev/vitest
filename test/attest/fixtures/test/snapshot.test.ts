import { attest } from '@ark/attest'
import { expect, test } from 'vitest'

test('inline', () => {
  expect(attest(1 + 2)).toMatchInlineSnapshot(`number`)
  expect(attest((1 + 2).toFixed)).toMatchInlineSnapshot(
    `(fractionDigits?: number | undefined) => string`,
  )
})

test('file', () => {
  expect(attest(1 + 2)).toMatchSnapshot()
  expect(attest((1 + 2).toFixed)).toMatchSnapshot()
})

test('mixed', () => {
  expect(1 + 2).toMatchInlineSnapshot(`3`)
  expect(1 + 2).toMatchSnapshot()
  expect(attest(1 + 2)).toMatchInlineSnapshot(`number`)
  expect(attest(1 + 2)).toMatchSnapshot()
})

test('errors', () => {
  expect(attest(1 / 2).type.toString).toMatchInlineSnapshot(`number`)
  expect(
    attest(
      () =>
        // @ts-expect-error test errors
        '1' / 2,
    ).type.errors,
  ).toMatchInlineSnapshot(
    `The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.`,
  )

  // make it work like `.type.toString` by default
  expect(attest(1 / 2)).toMatchInlineSnapshot(`number`)
})

test('completions', () => {
  // TODO(attest) not sure how to do so quick workaround to extract `attest().completions`
  expect({
    $workaroundCompletions: attest(
      () =>
        // @ts-expect-error test completions
        // eslint-disable-next-line dot-notation
        (1 + 2)['to'],
    ),
  }).toMatchInlineSnapshot(`
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
})
