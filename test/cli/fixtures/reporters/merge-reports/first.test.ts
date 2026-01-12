import { test, expect, beforeEach } from 'vitest'

console.log('global scope')

beforeEach(() => {
  console.log('beforeEach')
})

test('test 1-1', () => {
  expect(1).toBe(1)
})

test('test 1-2', () => {
  console.log('test 1-2')
  expect(1).toBe(2)
})
