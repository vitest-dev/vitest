import { test, expect } from 'vitest'
import { formatHello } from './sub/format'
import { hello } from './util'

test('passes', () => {
  expect(hello()).toBe('Hello, graph!')
  expect(formatHello()).toBe('Hello, graph!')
})
