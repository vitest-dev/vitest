import { expect, it } from 'vitest'
import { foo } from '../src/self'

// #1220 self export module
it('self export', () => {
  expect(foo()).toBe(true)
})
