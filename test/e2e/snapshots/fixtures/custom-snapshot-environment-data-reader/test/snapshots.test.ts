import { expect, test } from 'vitest'

test('regular snapshot', () => {
  expect({ a: 1 }).toMatchSnapshot()
})
