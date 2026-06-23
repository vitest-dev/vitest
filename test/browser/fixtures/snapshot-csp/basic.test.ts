import { expect, test } from 'vitest'

test('inline snapshot under CSP', () => {
  expect(1).toMatchInlineSnapshot(`1`)
})

test('file snapshot under CSP', () => {
  expect({ hello: 'world' }).toMatchSnapshot()
})
