import httpClient from 'http-client'
import { expect, test, vi } from 'vitest'

test('mocked http-client', async () => {
  const { default: mocked } = await vi.importMock<any>('http-client')

  await mocked.get('string')

  expect(mocked.get).toHaveBeenCalledWith('string')
})

test('actual http-client is not mocked', () => {
  expect(vi.isMockFunction(httpClient.get)).toBe(false)
})
