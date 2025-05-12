import { expect, it } from 'vitest'

it('foo', () => {
  if (process.env.TEST_OBSOLETE) return
  expect("foo").toMatchSnapshot();
})

it('bar', () => {
  expect("bar").toMatchSnapshot();
})
