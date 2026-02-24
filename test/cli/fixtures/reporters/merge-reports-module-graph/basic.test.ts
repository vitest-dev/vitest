import { test, expect } from 'vitest'
import { hello } from './util'

test('passes', () => {
  expect(hello()).toBe('Hello, world!')
})
