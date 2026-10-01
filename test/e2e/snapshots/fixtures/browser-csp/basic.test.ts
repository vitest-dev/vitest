import { expect, test } from 'vitest'

test('unsafe eval is blocked', () => {
  // eslint-disable-next-line no-new-func
  expect(() => new Function('')).toThrow()
})

test('snapshot', () => {
  expect('value').toMatchSnapshot()
})
