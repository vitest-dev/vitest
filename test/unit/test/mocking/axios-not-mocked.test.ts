import axios from 'axios'
import { expect, test, vi } from 'vitest'

test('mocked axios', async () => {
  const { default: ax } = await vi.importMock<any>('axios')

  await ax.get('string')

  expect(ax.get).toHaveBeenCalledWith('string')
})

test('actual axios is not mocked', async () => {
  expect(vi.isMockFunction(axios.get)).toBe(false)
})
