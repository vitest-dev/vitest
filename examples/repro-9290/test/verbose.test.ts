import { expect, test, vi } from 'vitest'
import something from '../src/module'

// Manual spy approach - this DOES collect coverage
vi.mock(import('../src/module'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    default: vi.spyOn(actual, 'default'),
  }
})

test('should spy on module and collect coverage with manual spy', () => {
  const result = something(5)
  expect(result).toBe(10)
  expect(something).toHaveBeenCalledWith(5)
})
