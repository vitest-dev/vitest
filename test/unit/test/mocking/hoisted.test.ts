import { expect, test, vi } from 'vitest'
import { asyncSquare as importedAsyncSquare, square as importedSquare } from '../../src/mocks/example'

const mocks = vi.hoisted(() => {
  return {
    square: vi.fn(),
  }
})

const { asyncSquare } = await vi.hoisted(async () => {
  return {
    asyncSquare: vi.fn(),
  }
})

vi.mock('../../src/mocks/example', () => {
  return {
    square: mocks.square,
    asyncSquare,
  }
})

test('hoisted works', () => {
  expect(importedSquare).toBe(mocks.square)
  expect(importedAsyncSquare).toBe(asyncSquare)
})
