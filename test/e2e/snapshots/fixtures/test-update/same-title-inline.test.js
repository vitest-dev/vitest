import { expect, test } from 'vitest'

test('same title', () => {
  expect('new').toMatchInlineSnapshot()
  expect('new').toMatchInlineSnapshot()
})

test('same title', () => {
  expect('a').toMatchInlineSnapshot(`"a"`)
  expect('a').toMatchInlineSnapshot(`"a"`)
})

test('same title', () => {
  expect('b').toMatchInlineSnapshot(`"wrong"`)
  expect('b').toMatchInlineSnapshot(`"wrong"`)
})
