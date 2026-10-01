import { expect, test } from 'vitest'

test('this will fail', () => {
  expect('This test should not be run').toBeFalsy()
})
