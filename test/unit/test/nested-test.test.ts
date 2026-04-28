import { describe, expect, test } from 'vitest'

test('nested test should throw error', () => {
  expect(() => {
    test('test inside test', () => {})
  }).toThrowErrorMatchingInlineSnapshot(`[Error: Calling the test function inside another test function is not allowed. Please put it inside "describe" or "suite" so it can be properly collected.]`)

  expect(() => {
    test.each([1, 2, 3])('test.each inside test %d', () => {})
  }).toThrowErrorMatchingInlineSnapshot(`[Error: Calling the test function inside another test function is not allowed. Please put it inside "describe" or "suite" so it can be properly collected.]`)

  expect(() => {
    test.skipIf(false)('test.skipIf inside test', () => {})
  }).toThrowErrorMatchingInlineSnapshot(`[Error: Calling the test function inside another test function is not allowed. Please put it inside "describe" or "suite" so it can be properly collected.]`)
})

describe('parallel tests', () => {
  test.concurrent('parallel test 1 with nested test', () => {
    expect(() => {
      test('test inside test', () => {})
    }).toThrowErrorMatchingInlineSnapshot(`[Error: Calling the test function inside another test function is not allowed. Please put it inside "describe" or "suite" so it can be properly collected.]`)
  })
  test.concurrent('parallel test 2 without nested test', () => {})
  test.concurrent('parallel test 3 without nested test', () => {})
  test.concurrent('parallel test 4 with nested test', () => {
    expect(() => {
      test('test inside test', () => {})
    }).toThrowErrorMatchingInlineSnapshot(`[Error: Calling the test function inside another test function is not allowed. Please put it inside "describe" or "suite" so it can be properly collected.]`)
  })
})
