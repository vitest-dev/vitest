import { expect, test } from 'vitest'

test('broken snapshot', () => {
  expect('value').toMatchSnapshot()
})
