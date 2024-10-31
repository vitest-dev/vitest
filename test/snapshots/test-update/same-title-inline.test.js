import { expect, test } from 'vitest'

test('same title', () => {
  expect('new').toMatchInlineSnapshot(`"new"`)
  expect('new').toMatchInlineSnapshot(`"new"`)
})

test('same title', () => {
  expect('a').toMatchInlineSnapshot(`"a"`)
  expect('a').toMatchInlineSnapshot(`"a"`)
})

test('same title', () => {
  expect('b').toMatchInlineSnapshot(`"b"`)
  expect('b').toMatchInlineSnapshot(`"b"`)
})
