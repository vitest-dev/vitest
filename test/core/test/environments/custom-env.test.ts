// @vitest-environment custom

import { expect, test } from 'vitest'

test('custom env is defined', () => {
  expect(expect.getState().environment).toBe('custom')
  expect((globalThis as any).testEnvironment).toBe('custom')
  expect((globalThis as any).option).toBe('config-option')

  expect((global as any).POOL_ID_DURING_ENV_SETUP).toBeDefined()
  expect(process.env.VITEST_POOL_ID).toBeDefined()
  expect((global as any).POOL_ID_DURING_ENV_SETUP).toBe(process.env.VITEST_POOL_ID)

  expect((global as any).WORKER_ID_DURING_ENV_SETUP).toBeDefined()
  expect(process.env.VITEST_WORKER_ID).toBeDefined()
  expect((global as any).WORKER_ID_DURING_ENV_SETUP).toBe(process.env.VITEST_WORKER_ID)
})
