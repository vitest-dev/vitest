import { expect, test, vi } from 'vitest'
import { hello } from './wrapper.js'

vi.mock(import('./wrapper.js'), () => {
  return { hello: () => 'mock-hello' }
})

test('basic', () => {
  expect(hello()).toBe('mock-hello')
})
