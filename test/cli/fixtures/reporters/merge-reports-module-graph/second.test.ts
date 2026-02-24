import { test, expect } from 'vitest'
import { hello } from './util'

test('also passes', () => {
  expect(hello()).toBe('Hello, graph!')
})
