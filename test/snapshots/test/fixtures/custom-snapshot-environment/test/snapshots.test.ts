import {test, expect} from 'vitest'

test('regular snapshot', () => {
  expect({ a: 1 }).toMatchSnapshot()
})

test('inline snapshot', () => {
  expect({ a: 1 }).toMatchInlineSnapshot()
})
