import { expect, test, vi } from 'vitest'
import { topLevelAnswer } from '../src/from-async.ts'

// for the test to be accurate, the factory has to be async
vi.mock(import('../src/mock-async.ts'), async () => {
  return {
    answer: 42 as 0,
  }
})

test('imported value is defined', () => {
  expect(topLevelAnswer).toBe(42)
})
