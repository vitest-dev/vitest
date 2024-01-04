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

test('file snapshot absent', async () => {
  await expect(null)
    .toMatchFileSnapshot('./__snapshots__/custom/my_snapshot_absent')
})
