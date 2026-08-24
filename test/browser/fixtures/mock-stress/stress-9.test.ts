import { expect, test, vi } from 'vitest'
import { answer, tag } from './src/dep-9'
import { greet } from './src/spy-9'

vi.mock(import('./src/dep-9'), () => ({
  tag: 'mock-9',
  answer: () => 'mock-answer-9',
}))

vi.mock(import('./src/spy-9'), { spy: true })

test('stress-9: factory mock is applied', () => {
  expect(tag).toBe('mock-9')
  expect(answer()).toBe('mock-answer-9')
})

test('stress-9: spy mock wraps the module', () => {
  expect(vi.isMockFunction(greet)).toBe(true)
  vi.mocked(greet).mockReturnValue('patched-9')
  expect(greet()).toBe('patched-9')
})
