import { expect, test } from 'vitest'

test('snapshot', () => {
  expect({
    this: { is: new Set(['of', 'snapshot']) },
  }).toMatchSnapshot()
})

test('inline snapshot', () => {
  expect('inline string').toMatchInlineSnapshot('"inline string"')
  expect({ foo: { type: 'object', map: new Map() } }).toMatchInlineSnapshot(`
Object {
  "foo": Object {
    "map": Map {},
    "type": "object",
  },
}`)
})

test('snapshot', () => {
  expect({
    this: { is: new Set(['one', new Array(300).fill({})]) },
  }).toMatchSnapshot()
})
