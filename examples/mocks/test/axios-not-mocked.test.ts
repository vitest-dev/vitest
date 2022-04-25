import axios from 'axios'

test('mocked axios', async () => {
  const { default: ax } = await vi.importMock('axios')

  await ax.get('string')

  expect(ax.get).toHaveBeenCalledWith('string')
})

test('actual axios is not mocked', async () => {
  expect(vi.isMockFunction(axios.get)).toBe(false)
})
