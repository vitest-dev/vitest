import { expect, test } from 'vitest'

test('inline snapshot', () => {
  expect(1).toMatchInlineSnapshot('1')
})

test('snapshot', () => {
  expect(1).toMatchSnapshot()
})

test('file snapshot', async () => {
  await expect('my snapshot content')
    .toMatchFileSnapshot('./__snapshots__/custom/my_snapshot')
})
