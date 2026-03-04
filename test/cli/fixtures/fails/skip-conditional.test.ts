import { expect, it } from 'vitest';

it('skips correctly', ({ skip }) => {
  skip(true)
  expect.unreachable()
})

it('doesnt skip correctly', ({ skip }) => {
  skip(false)
  throw new Error('doesnt skip')
})
