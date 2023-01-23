import { expect, test } from 'vitest'

test('inline snapshot', () => {
  expect(1).toMatchInlineSnapshot('1')
})

test('file snapshot', () => {
  expect(1).toMatchSnapshot()
})
