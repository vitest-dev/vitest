import { expect, test, vi } from 'vitest'
import { shared } from '../src/shared'

vi.unmock('../src/shared')

test('vi.unmock of a mock that the page already imported', () => {
  expect(shared()).toBe('original')
})
