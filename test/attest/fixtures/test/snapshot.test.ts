import { expect, test } from 'vitest'

test('inline', () => {
  expect(1 + 2).toMatchTypeInlineSnapshot(`number`)
  expect((1 + 2).toFixed).toMatchTypeInlineSnapshot(`(fractionDigits?: number | undefined) => string`)
})

test('file', () => {
  expect(1 + 2).toMatchTypeSnapshot()
  expect((1 + 2).toPrecision).toMatchTypeSnapshot()
})
