/* body */
import { expect, it } from 'vitest'
import { add } from './utils'

it('add', () => {
  expect(add()).toBe(100)
  expect(add(1)).toBe(1)
  return expect(add(1, 2, 3)).toBe(6)
})
