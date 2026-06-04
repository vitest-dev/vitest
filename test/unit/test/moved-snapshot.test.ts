import { expect, test } from 'vitest'

test('snapshot is stored close to file', () => {
  expect('moved snapshot').toMatchSnapshot()
})
