import { expect, test, vi } from 'vitest'
import { double, triple } from '../src/mock-target'

// Manual spy approach using importOriginal callback - this collects coverage
vi.mock(import('../src/mock-target'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    double: vi.fn(actual.double),
    triple: vi.fn(actual.triple),
  }
})

test('importActual calls original and can be spied on', () => {
  expect(double(5)).toBe(10)
  expect(double).toHaveBeenCalledWith(5)
  expect(triple).not.toHaveBeenCalled()
})
