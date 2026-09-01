import { expect, test, vi } from 'vitest'
import { answer, tag } from './src/dep-5'
import { greet } from './src/spy-5'

vi.mock(import('./src/dep-5'), () => ({
  tag: 'mock-5',
  answer: () => 'mock-answer-5',
}))

vi.mock(import('./src/spy-5'), { spy: true })

test('stress-5: factory mock is applied', () => {
  expect(tag).toBe('mock-5')
  expect(answer()).toBe('mock-answer-5')
})

test('stress-5: spy mock wraps the module', () => {
  expect(vi.isMockFunction(greet)).toBe(true)
  vi.mocked(greet).mockReturnValue('patched-5')
  expect(greet()).toBe('patched-5')
})
