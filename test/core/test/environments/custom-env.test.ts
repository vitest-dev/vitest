// @vitest-environment custom

import { expect, test } from 'vitest'

test('custom env is defined', () => {
  expect(expect.getState().environment).toBe('custom')
  expect((globalThis as any).testEnvironment).toBe('custom')
  expect((globalThis as any).option).toBe('config-option')
})
