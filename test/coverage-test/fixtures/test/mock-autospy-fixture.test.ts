import { expect, test, vi } from 'vitest'
import { double, triple } from '../src/mock-target'

vi.mock(import('../src/mock-target'), { spy: true })

test('autospy calls original and can be spied on', () => {
  expect(double(5)).toBe(10)
  expect(double).toHaveBeenCalledWith(5)
  expect(triple).not.toHaveBeenCalled()
})
