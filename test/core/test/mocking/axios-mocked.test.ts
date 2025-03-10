import axios_ from 'axios'
import { expect, test, vi } from 'vitest'

// workaround https://github.com/oxc-project/oxc/issues/9645
const axios = axios_

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
