import { expect, test } from 'vitest'
import "./basic-extend"

test('all literal', () => {
  expect({ name: 'alice', age: '30' }).toMatchKvSnapshot()
})

test('with regex', () => {
  expect({ name: 'bob', age: '24', score: '999', status: 'active' }).toMatchKvSnapshot()
})

test('empty snapshot', () => {
  expect({}).toMatchKvSnapshot()
})
