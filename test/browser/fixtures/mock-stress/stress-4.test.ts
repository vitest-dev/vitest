import { expect, test, vi } from 'vitest'
import { answer, tag } from './src/dep-4'
import { greet } from './src/spy-4'

vi.mock(import('./src/dep-4'), () => ({
  tag: 'mock-4',
  answer: () => 'mock-answer-4',
}))

vi.mock(import('./src/spy-4'), { spy: true })

test('stress-4: factory mock is applied', () => {
  expect(tag).toBe('mock-4')
  expect(answer()).toBe('mock-answer-4')
})

test('stress-4: spy mock wraps the module', () => {
  expect(vi.isMockFunction(greet)).toBe(true)
  vi.mocked(greet).mockReturnValue('patched-4')
  expect(greet()).toBe('patched-4')
})
