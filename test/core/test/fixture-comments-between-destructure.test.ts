/* eslint-disable style/spaced-comment */
import { test as base, expect } from 'vitest'

const test = base.extend<{
  one: 1
  two: 2
}>({
  one: 1,
  two: 2,
})

test('no comments', ({ one, two }) => {
  expect(one).toBe(1)
  expect(two).toBe(2)
})

test('inline comment', ({
  one,
  // comment
  two,
}) => {
  expect(one).toBe(1)
  expect(two).toBe(2)
})

test('multiline comment', ({
  one,
  /**
   * comment
   */
  two,
}) => {
  expect(one).toBe(1)
  expect(two).toBe(2)
})

test('inline legal comment', ({
  one,
  //! comment
  two,
}) => {
  expect(one).toBe(1)
  expect(two).toBe(2)
})

test('multiline legal comment', ({
  one,
  /*! comment */
  two,
}) => {
  expect(one).toBe(1)
  expect(two).toBe(2)
})
