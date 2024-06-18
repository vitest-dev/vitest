import { expect, test, vi } from 'vitest'

test('inline snapshot', () => {
  expect(1).toMatchInlineSnapshot('1')
})

test('basic', () => {
  expect(1).toMatchSnapshot()
})

test('renders inline mock snapshot', () => {
  const fn = vi.fn()
  expect(fn).toMatchInlineSnapshot('[MockFunction spy]')
  fn('hello', 'world', 2)
  expect(fn).toMatchInlineSnapshot()
})

test('file snapshot', async () => {
  await expect('my snapshot content')
    .toMatchFileSnapshot('./__snapshots__/custom/my_snapshot')
})

