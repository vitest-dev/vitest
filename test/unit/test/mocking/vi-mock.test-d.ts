import { test, vi } from 'vitest'

vi.mock(import('../../src/mockedClassInstance.js'), () => ({
  default: { info: vi.fn(), warn: vi.fn() },
}))

vi.mock(import('../../src/mockedA.js'), () => ({
  mockedA: vi.fn(),
}))

test('vi.mock with import() accepts vi.fn() for class instance with private fields', () => {})

test('vi.mock with import() accepts partial module mock', () => {})
