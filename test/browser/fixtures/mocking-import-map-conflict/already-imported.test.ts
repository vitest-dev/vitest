import { expect, test, vi } from 'vitest'
import { answer } from './source'

vi.mock('./source')

test('the module was imported by the setup file before it was mocked', () => {
  expect(vi.isMockFunction(answer)).toBe(true)
})
