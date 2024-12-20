import { test, expect } from 'vitest'

test('basic', () => {
  expect('hello').toMatchSnapshot()
})
