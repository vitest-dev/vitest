import { expect, test, vi } from 'vitest'

test('global setup provides data correctly', () => {
  expect(vi.inject('globalSetup')).toBe(true)
  expect(vi.inject('globalSetupOverriden')).toBe(true)
  expect(vi.inject('invalidValue')).toBe(undefined)
})
