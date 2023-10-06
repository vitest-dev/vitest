import { expect, test } from 'vitest'

test('nested test should throw error', () => {
  expect(() => {
    test('test inside test', () => {})
  }).toThrowErrorMatchingInlineSnapshot(`"Nested tests are not supported"`)

  expect(() => {
    test.each([1, 2, 3])('test.each inside test %d', () => {})
  }).toThrowErrorMatchingInlineSnapshot(`"Nested tests are not supported"`)

  expect(() => {
    test.skipIf(false)('test.skipIf inside test', () => {})
  }).toThrowErrorMatchingInlineSnapshot(`"Nested tests are not supported"`)
})
