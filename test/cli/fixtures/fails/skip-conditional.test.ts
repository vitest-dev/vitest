import { expect, it } from 'vitest';

it('skips correctly', (t) => {
  t.skip(true)
  expect.unreachable()
})

it('doesnt skip correctly', (t) => {
  t.skip(false)
  throw new Error('doesnt skip')
})
