import { expect, test } from 'vitest'

// I am comment1
// I am comment2
test('should fail', () => {
  // eslint-disable-next-line no-console
  console.log('json-fail>should fail')
  expect(2).toEqual(1)
})
