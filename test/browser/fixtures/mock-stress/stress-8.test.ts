import { expect, test, vi } from 'vitest'
import { answer, tag } from './src/dep-8'
import { greet } from './src/spy-8'

vi.mock(import('./src/dep-8'), () => ({
  tag: 'mock-8',
  answer: () => 'mock-answer-8',
}))

vi.mock(import('./src/spy-8'), { spy: true })

test('stress-8: factory mock is applied', () => {
  expect(tag).toBe('mock-8')
  expect(answer()).toBe('mock-answer-8')
})

test('stress-8: spy mock wraps the module', () => {
  expect(vi.isMockFunction(greet)).toBe(true)
  vi.mocked(greet).mockReturnValue('patched-8')
  expect(greet()).toBe('patched-8')
})
