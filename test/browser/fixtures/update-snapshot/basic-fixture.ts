import { expect, test, vi } from 'vitest'

interface _BasicInterface {
  willBeRemoved: boolean
  leavingSourceMapIncorrect: boolean
}

test('inline snapshot', () => {
  expect(1).toMatchInlineSnapshot('1')
})

test('basic', () => {
  expect(1).toMatchSnapshot()
})

test('renders inline mock snapshot', () => {
  const fn = vi.fn()
  expect(fn).toMatchInlineSnapshot()
  fn('hello', 'world', 2)
  expect(fn).toMatchInlineSnapshot()
})

test('file snapshot', async () => {
  await expect('my snapshot content')
    .toMatchFileSnapshot('./__snapshots__/custom/my_snapshot')
})

