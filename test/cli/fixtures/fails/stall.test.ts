import { test } from 'vitest'

// https://github.com/vitest-dev/vitest/issues/374
// Passing `Error` instances across message channels could cause the test runner to stall, if
// multiple tests fail. This suite is successful if it does not timeout, which is verified by the
// test runner.

test('test 1', () => {
  throw new TypeError('failure')
})
test('test 2', () => {
  throw new TypeError('failure')
})
test('test 3', () => {
  throw new TypeError('failure')
})
test('test 4', () => {
  throw new TypeError('failure')
})
