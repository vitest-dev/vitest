import { expect, test, vi } from 'vitest'
import { answer, tag } from './src/dep-10'
import { greet } from './src/spy-10'

vi.mock(import('./src/dep-10'), () => ({
  tag: 'mock-10',
  answer: () => 'mock-answer-10',
}))

vi.mock(import('./src/spy-10'), { spy: true })

test('stress-10: factory mock is applied', () => {
  expect(tag).toBe('mock-10')
  expect(answer()).toBe('mock-answer-10')
})

test('stress-10: spy mock wraps the module', () => {
  expect(vi.isMockFunction(greet)).toBe(true)
  vi.mocked(greet).mockReturnValue('patched-10')
  expect(greet()).toBe('patched-10')
})
