import { expect, test, vi } from 'vitest'
import { getAuthToken } from '../../src/env'

vi.mock(import('../../src/env'), { spy: true })

test('getAuthToken is spied', async () => {
  import.meta.env.AUTH_TOKEN = '123'
  const token = getAuthToken()
  expect(token).toBe('123')
  expect(getAuthToken).toHaveBeenCalledTimes(1)
  vi.mocked(getAuthToken).mockRestore()
  expect(vi.isMockFunction(getAuthToken)).toBe(false)
})
