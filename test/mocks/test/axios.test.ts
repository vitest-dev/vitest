import axios from 'axios'

vi.mock('axios')

test('mocked axios', async() => {
  await axios.get('string')

  expect(axios.get).toHaveBeenCalledWith('string')
})

test('can get actual axios', async() => {
  const ax = await vi.importActual<typeof axios>('axios')

  expect(vi.isMockFunction(ax.get)).toBe(false)
})
