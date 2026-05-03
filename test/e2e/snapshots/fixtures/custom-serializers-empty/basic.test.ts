import { expect, test } from 'vitest'

expect.addSnapshotSerializer({
  test(value) {
    return value && typeof value === 'object' && '__unwrap__' in value
  },
  serialize(value) {
    return value.__unwrap__
  },
})

test('file empty', () => {
  expect({ __unwrap__: "" }).toMatchSnapshot()
})

test('inline empty', () => {
  expect({ __unwrap__: "" }).toMatchInlineSnapshot(``)
})

test('file whitespaces', () => {
  expect({ __unwrap__: " ".repeat(4) }).toMatchSnapshot()
})

test('inline whitespaces', () => {
  expect({ __unwrap__: " ".repeat(4) }).toMatchInlineSnapshot(``)
})
