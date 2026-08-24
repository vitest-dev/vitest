import { expect, test, vi } from 'vitest'
import { answer, tag } from './src/dep-7'
import { greet } from './src/spy-7'

vi.mock(import('./src/dep-7'), () => ({
  tag: 'mock-7',
  answer: () => 'mock-answer-7',
}))

vi.mock(import('./src/spy-7'), { spy: true })

test('stress-7: factory mock is applied', () => {
  expect(tag).toBe('mock-7')
  expect(answer()).toBe('mock-answer-7')
})

test('stress-7: spy mock wraps the module', () => {
  expect(vi.isMockFunction(greet)).toBe(true)
  vi.mocked(greet).mockReturnValue('patched-7')
  expect(greet()).toBe('patched-7')
})
