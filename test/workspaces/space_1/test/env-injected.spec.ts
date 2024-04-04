import { expect, test } from 'vitest'

declare global {
  const __DEV__: boolean
}

test('dev is injected', () => {
  expect(__DEV__).toBe(true)
})

test('env variable is assigned', () => {
  // we override it with "local" in .env.local, but dotenv prefers the root .env
  // this is consistent with how Vite works
  expect(import.meta.env.VITE_MY_TEST_VARIABLE).toBe('core')
  expect(process.env.VITE_MY_TEST_VARIABLE).toBe('core')
  expect(import.meta.env.CUSTOM_MY_TEST_VARIABLE).toBe('custom')
  expect(process.env.CUSTOM_MY_TEST_VARIABLE).toBe('custom')

  expect(process.env.VITE_CORE_VARIABLE).toBe('core')
  expect(process.env.CUSTOM_ROOT).toBe('custom')
  expect(process.env.ROOT_VARIABLE).toBe('root')
  expect(process.env.CONFIG_VAR).toBe('root')
  expect(process.env.CONFIG_LOCAL).toBe('local')
  expect(process.env.CONFIG_OVERRIDE).toBe('local')
})
