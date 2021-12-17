import axios from 'axios'

test.skip('mocked axios', async() => {
  const { default: ax } = await vi.requireMock('axios')

  await ax.get('string')

  expect(ax.get).toHaveBeenCalledWith('string')
})

test.skip('actual axios is not mocked', async() => {
  expect(vi.isMockFunction(axios.get)).toBe(false)
})
