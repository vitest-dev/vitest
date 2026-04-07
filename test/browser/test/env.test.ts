import { expect, test } from 'vitest'
import { getAuthToken } from '../src/env'

test('reads envs from .env file', () => {
  expect(import.meta.env.VITE_TEST_ENV).toBe('local')
})

test('can reassign env locally', () => {
  import.meta.env.VITEST_ENV = 'TEST'
  expect(import.meta.env.VITEST_ENV).toBe('TEST')
})

test('can reassign env everywhere', () => {
  import.meta.env.AUTH_TOKEN = '123'
  expect(getAuthToken()).toBe('123')
})

test('custom env', () => {
  expect(import.meta.env.CUSTOM_ENV).toBe('foo')
})

test('import.meta.env via define', () => {
  expect(import.meta.env.DEFINE_CUSTOM_ENV).toBe('define-custom-env')
})

test('ignores import.meta.env in string literals', () => {
  expect('import.meta.env').toBe('import' + '.meta.env')
})

test('define process and using import.meta.env together', () => {
  const process = {}
  expect(process).toMatchObject({})
  expect(import.meta.env.MODE).toEqual('test')
})

test('PROD, DEV, SSR should be boolean', () => {
  expect(import.meta.env.PROD).toBe(false)
  expect(import.meta.env.DEV).toBe(true)

  expect(import.meta.env.SSR).toBe(false)

  import.meta.env.SSR = true
  expect(import.meta.env.SSR).toEqual(true)
})
