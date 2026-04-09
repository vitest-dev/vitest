import { expect, test } from 'vitest'
import "../domain/basic-extend"

test('file', () => {
  expect({ name: 'alice', age: '30' }).toMatchKvSnapshot()
})

test('inline', () => {
  expect({ name: 'alice', age: '30' }).toMatchKvInlineSnapshot(`
    name=bob
    inine-broken
  `)
})
