/* body */
import { expect, it } from 'vitest'
import { add } from './utils'

interface Num {
  count: number
}

const a: Num = { count: 10 }

it('add', () => {
  expect(add(a.count)).toBe(100)
  expect(add(1)).toBe(1)
  return expect(add(1, 2, 3)).toBe(6)
})
