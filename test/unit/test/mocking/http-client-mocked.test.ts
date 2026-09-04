import httpClient from 'http-client'
import { expect, test, vi } from 'vitest'

vi.mock('http-client')

test('mocked http-client', async () => {
  await httpClient.get('string')

  expect(httpClient.get).toHaveBeenCalledWith('string')
  expect(httpClient.post).toBeUndefined()
})

test('can get actual http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('http-client')

  expect(vi.isMockFunction(actual.get)).toBe(false)
})
