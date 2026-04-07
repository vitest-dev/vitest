import axios from 'axios'
import { expect, test, vi } from 'vitest'
import { getAuthToken } from '../../src/env'
import * as NamespaceModule from '../../src/mocks/autospying-namespace/index.js'

vi.mock(import('../../src/env'), { spy: true })

vi.mock('axios', { spy: true })
vi.mock('../../src/mocks/autospying-namespace/index.js', { spy: true })

test('getAuthToken is spied', async () => {
  import.meta.env.AUTH_TOKEN = '123'
  const token = getAuthToken()
  expect(token).toBe('123')
  expect(getAuthToken).toHaveBeenCalledTimes(1)
  vi.mocked(getAuthToken).mockRestore()
  // module mocks cannot be restored
  expect(vi.isMockFunction(getAuthToken)).toBe(true)
})

test('package in __mocks__ has lower priority', async () => {
  expect(vi.isMockFunction(axios.get)).toBe(true)

  // isAxiosError is not defined in __mocks__
  expect(axios.isAxiosError(new Error('test'))).toBe(false)
  expect(axios.isAxiosError).toHaveBeenCalled()
})

test('spies on namespace re-exports', async () => {
  expect(vi.isMockFunction(NamespaceModule.NamespaceTarget.computeSquare)).toBe(true)
  expect(NamespaceModule.NamespaceTarget.computeSquare(5)).toBe(25)
  expect(NamespaceModule.NamespaceTarget.computeSquare).toHaveBeenCalledTimes(1)
})
