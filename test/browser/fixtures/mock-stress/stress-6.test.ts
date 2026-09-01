import { expect, test, vi } from 'vitest'
import { answer, tag } from './src/dep-6'
import { greet } from './src/spy-6'

vi.mock(import('./src/dep-6'), () => ({
  tag: 'mock-6',
  answer: () => 'mock-answer-6',
}))

vi.mock(import('./src/spy-6'), { spy: true })

test('stress-6: factory mock is applied', () => {
  expect(tag).toBe('mock-6')
  expect(answer()).toBe('mock-answer-6')
})

test('stress-6: spy mock wraps the module', () => {
  expect(vi.isMockFunction(greet)).toBe(true)
  vi.mocked(greet).mockReturnValue('patched-6')
  expect(greet()).toBe('patched-6')
})
