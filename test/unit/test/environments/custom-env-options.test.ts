// @vitest-environment custom
// @vitest-environment-options { "config": { "label": "custom2" } }

import { expect, test } from 'vitest'

test('custom env is defined', () => {
  expect(expect.getState().environment).toBe('custom')
  expect((globalThis as any).testEnvironment).toBe('custom')
  expect((globalThis as any).option).toBe('config-option')
  expect((globalThis as any).customConfig).toEqual({
    label: 'custom2',
    name: 'custom',
  })
})
