import { expect, test, vi } from 'vitest'
import { answer, tag } from './src/dep-2'
import { greet } from './src/spy-2'

vi.mock(import('./src/dep-2'), () => ({
  tag: 'mock-2',
  answer: () => 'mock-answer-2',
}))

vi.mock(import('./src/spy-2'), { spy: true })

test('stress-2: factory mock is applied', () => {
  expect(tag).toBe('mock-2')
  expect(answer()).toBe('mock-answer-2')
})

test('stress-2: spy mock wraps the module', () => {
  expect(vi.isMockFunction(greet)).toBe(true)
  vi.mocked(greet).mockReturnValue('patched-2')
  expect(greet()).toBe('patched-2')
})
