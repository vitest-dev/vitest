import { expect, test } from 'vitest'

test('toMatchSnapshot', () => {
  expect.soft('--snap-1--').toMatchSnapshot()
  expect.soft('--snap-2--').toMatchSnapshot()
})

test('toMatchFileSnapshot', async () => {
  await expect.soft('--file-1--').toMatchFileSnapshot('./__snapshots__/custom1.txt')
  await expect.soft('--file-2--').toMatchFileSnapshot('./__snapshots__/custom2.txt')
})

test('toThrowErrorMatchingSnapshot', () => {
  expect.soft(() => { throw new Error('--error-1--') }).toThrowErrorMatchingSnapshot()
  expect.soft(() => { throw new Error('--error-2--') }).toThrowErrorMatchingSnapshot()
})
