import { expect, inject, test } from 'vitest'

test('global setup provides data correctly', () => {
  expect(inject('globalSetup')).toBe(true)
  expect(inject('globalSetupOverridden')).toBe(true)
  expect(inject('projectConfigValue')).toBe(true)
  expect(inject('globalConfigValue')).toBe(true)
  expect(inject('invalidValue')).toBe(undefined)
})
