import { expect, test, vi } from 'vitest'
import { answer, tag } from './src/dep-3'
import { greet } from './src/spy-3'

vi.mock(import('./src/dep-3'), () => ({
  tag: 'mock-3',
  answer: () => 'mock-answer-3',
}))

vi.mock(import('./src/spy-3'), { spy: true })

test('stress-3: factory mock is applied', () => {
  expect(tag).toBe('mock-3')
  expect(answer()).toBe('mock-answer-3')
})

test('stress-3: spy mock wraps the module', () => {
  expect(vi.isMockFunction(greet)).toBe(true)
  vi.mocked(greet).mockReturnValue('patched-3')
  expect(greet()).toBe('patched-3')
})
