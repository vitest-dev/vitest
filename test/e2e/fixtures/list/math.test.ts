import { expect, it } from 'vitest'

console.log('logging during collection')

it('1 plus 1', () => {
  expect(1 + 1).toBe(2)
})

it('failing test', () => {
  expect(1 + 1).toBe(3)
})
