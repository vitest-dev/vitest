import { expect, test } from 'vitest'

test('inline', () => {
  // TODO
  expect(1 + 2).toMatchTypeInlineSnapshot()
  expect((1 + 2).toFixed).toMatchTypeInlineSnapshot()
})

test('file', () => {
  expect(1 + 2).toMatchTypeSnapshot()
  expect((1 + 2).toPrecision).toMatchTypeSnapshot()
})
