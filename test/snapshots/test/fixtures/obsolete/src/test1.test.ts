import { expect, it } from 'vitest'

it('foo', () => {
  if (process.env.TEST_OBSOLETE) return
  expect("foo").toMatchSnapshot();
})

it('fuu', () => {
  if (process.env.TEST_OBSOLETE) return
  expect("fuu").toMatchSnapshot();
})

it('bar', () => {
  expect("bar").toMatchSnapshot();
})
