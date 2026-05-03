import { expect, test } from 'vitest'
import "../domain/basic-extend"

test('all literal', () => {
  expect({ name: 'alice', age: '30' }).toMatchKvInlineSnapshot(`
    name=alice
    age=30
  `)
})

test('with regex', () => {
  expect({ name: 'bob', score: '999', status: 'active' }).toMatchKvInlineSnapshot(`
    name=bob
    score=999
    status=active
  `)
})

test('empty snapshot', () => {
  expect({}).toMatchKvInlineSnapshot(``)
})
