import { expect, test, vi } from 'vitest'
import { source as automocked } from './src/setup-automock'
import { source as factory } from './src/setup-factory'

vi.unmock('./src/setup-automock')
vi.unmock('./src/setup-factory')

test('vi.unmock restores modules mocked in the setup file', () => {
  expect(automocked()).toBe('original')
  expect(factory()).toBe('original')
})
