import { expect, test } from 'vitest'

test('x', () => {
  expect(0).toMatchSnapshot()
})

// REMOVE-START
test('y', () => {
  expect(0).toMatchSnapshot()
})
// REMOVE-END
