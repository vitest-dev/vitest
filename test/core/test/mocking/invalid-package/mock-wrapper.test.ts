import { expect, test, vi } from 'vitest'
import { hello } from './wrapper.js'

// TODO: ideally we shouldn't need to load/transform manually mocked module
vi.mock(import('./wrapper.js'), () => {
  return { hello: () => 'mock-hello' }
})

test('repro', () => {
  expect(hello()).toBe('mock-hello')
})
