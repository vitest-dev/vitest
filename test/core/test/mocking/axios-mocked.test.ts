import axios from 'axios'
import { expect, test, vi } from 'vitest'

vi.mock('axios')

test('mocked axios', async () => {
  await axios.get('string')

  expect(axios.get).toHaveBeenCalledWith('string')
  expect(axios.post).toBeUndefined()
})

test('can get actual axios', async () => {
  const ax = await vi.importActual<typeof axios>('axios')

  expect(vi.isMockFunction(ax.get)).toBe(false)
})
