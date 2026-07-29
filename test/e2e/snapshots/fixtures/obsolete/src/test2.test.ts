import { expect, it } from 'vitest'

it('foo', () => {
  expect("foo").toMatchSnapshot();
})

it('bar', () => {
  expect("bar").toMatchSnapshot();
})
