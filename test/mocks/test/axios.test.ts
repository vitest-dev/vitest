import axios from 'axios'

vi.mock('axios')

test.skip('mocked axios', async() => {
  await axios.get('string')

  expect(axios.get).toHaveBeenCalledWith('string')
})

test.skip('can get actual axios', async() => {
  const ax = await vi.requireActual<typeof axios>('axios')

  expect(vi.isMockFunction(ax.get)).toBe(false)
})
