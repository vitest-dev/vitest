import { expect, test, vi } from 'vitest'
import something from '../src/module'

// Using { spy: true } - this should collect coverage but currently doesn't
vi.mock(import('../src/module'), { spy: true })

test('should spy on module and collect coverage with spy: true', () => {
  const result = something(5)
  expect(result).toBe(10)
  expect(something).toHaveBeenCalledWith(5)
})
