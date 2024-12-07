import axios from 'axios'
import { expect, test, vi } from 'vitest'
import { getAuthToken } from '../../src/env'

vi.mock(import('../../src/env'), { spy: true })

vi.mock('axios', { spy: true })

test('getAuthToken is spied', async () => {
  import.meta.env.AUTH_TOKEN = '123'
  const token = getAuthToken()
  expect(token).toBe('123')
  expect(getAuthToken).toHaveBeenCalledTimes(1)
  vi.mocked(getAuthToken).mockRestore()
  expect(vi.isMockFunction(getAuthToken)).toBe(false)
})

test('package in __mocks__ has lower priority', async () => {
  expect(vi.isMockFunction(axios.get)).toBe(true)

  // isAxiosError is not defined in __mocks__
  expect(axios.isAxiosError(new Error('test'))).toBe(false)
  expect(axios.isAxiosError).toHaveBeenCalled()
})
