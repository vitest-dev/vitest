import { expect, test, vi } from 'vitest'
import { answer, tag } from './src/dep-1'
import { greet } from './src/spy-1'

vi.mock(import('./src/dep-1'), () => ({
  tag: 'mock-1',
  answer: () => 'mock-answer-1',
}))

vi.mock(import('./src/spy-1'), { spy: true })

test('stress-1: factory mock is applied', () => {
  expect(tag).toBe('mock-1')
  expect(answer()).toBe('mock-answer-1')
})

test('stress-1: spy mock wraps the module', () => {
  expect(vi.isMockFunction(greet)).toBe(true)
  vi.mocked(greet).mockReturnValue('patched-1')
  expect(greet()).toBe('patched-1')
})
