import { expect, test, vi } from 'vitest'
import { fromDep, fromDep2, fromDep3, own } from './src/star_barrel'

vi.mock(import('./src/star_barrel'), () => ({
  fromDep: 'mocked dep',
  fromDep2: 'mocked dep2',
  fromDep3: 'mocked dep3',
  own: 'mocked own',
}))

test('a factory replaces exports that the module re-exports with export *', () => {
  expect(fromDep).toBe('mocked dep')
  expect(fromDep2).toBe('mocked dep2')
  expect(fromDep3).toBe('mocked dep3')
  expect(own).toBe('mocked own')
})
