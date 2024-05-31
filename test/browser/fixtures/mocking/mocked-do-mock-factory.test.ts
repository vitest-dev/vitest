import { expect, test, vi } from 'vitest'

test('adds', async () => {
  vi.doMock(import('./src/mocks_factory'), () => {
    return {
      calculator: () => 1166,
      mocked: true,
    }
  })

  const { mocked, calculator } = await import('./src/mocks_factory')
  expect(mocked).toBe(true)
  expect(calculator('plus', 1, 2)).toBe(1166)
})
