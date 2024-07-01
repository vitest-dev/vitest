import { expect, inject, test } from 'vitest'

test('global setup provides data correctly', () => {
  expect(inject('globalSetup')).toBe(true)
  expect(inject('globalSetupOverriden')).toBe(true)
  expect(inject('invalidValue')).toBe(undefined)
})
