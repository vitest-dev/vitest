import { resolve } from 'node:path'
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

test('cwd is resolved correctly', () => {
  const spaceRoot = resolve(import.meta.dirname, '..')
  const rootPath = resolve(spaceRoot, '..')

  expect(process.env.ROOT_CWD_CONFIG).toBe(rootPath)
  expect(process.env.ROOT_CWD_SERVER).toBe(rootPath)

  // ideally, it should be a `spaceRoot`, but support was reverted
  // in https://github.com/vitest-dev/vitest/pull/6811
  expect(process.env.SPACE_2_CWD_CONFIG).toBe(rootPath)
  expect(process.env.SPACE_2_CWD_SERVER).toBe(rootPath)
})
