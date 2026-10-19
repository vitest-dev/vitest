import { expect, test, vi } from 'vitest'
import { own } from '../src/own'

vi.mock('../src/own', () => ({ own: () => 'mocked' }))

test('a module that no other file imports', () => {
  expect(own()).toBe('mocked')
})
