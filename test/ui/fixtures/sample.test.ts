import { expect, it } from 'vitest'

it('add', () => {
  // eslint-disable-next-line no-console
  console.log('log test')
  setTimeout(() => {
    throw new Error('error')
  })
  expect(1 + 1).toEqual(2)
})
