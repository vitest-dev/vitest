import { expect, test, vi } from 'vitest'
import { double, triple } from '../src/mock-autospy-target'

vi.mock(import('../src/mock-autospy-target'), { spy: true })

test('autospy calls original and can be spied on', () => {
  expect(double(5)).toBe(10)
  expect(double).toHaveBeenCalledWith(5)
  expect(triple).not.toHaveBeenCalled()
})
