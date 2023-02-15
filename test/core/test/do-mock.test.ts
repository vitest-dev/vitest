import { expect, test, vi } from 'vitest'

test('doMock works', async () => {
  const { increment: incrementWith1 } = await import('./fixtures/increment')
  expect(incrementWith1(1)).toBe(2)

  vi.doMock('./fixtures/increment', () => ({
    increment: (num: number) => num + 10,
  }))

  const { increment: incrementWith10 } = await import('./fixtures/increment')

  expect(incrementWith10(1)).toBe(11)
})

test('the second doMock can override the first doMock', async () => {
  vi.doMock('./fixtures/increment', () => ({
    increment: (num: number) => num + 10,
  }))

  const { increment: incrementWith1 } = await import('./fixtures/increment')

  expect(incrementWith1(1)).toBe(11)

  vi.doMock('./fixtures/increment', () => ({
    increment: (num: number) => num + 20,
  }))

  const { increment: incrementWith20 } = await import('./fixtures/increment')

  expect(incrementWith20(1)).toBe(21)
})
