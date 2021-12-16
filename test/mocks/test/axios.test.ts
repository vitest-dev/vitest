import axios from 'axios'

vi.mock('axios')

test('mocked axios', async() => {
  await axios.get('string')

  expect(axios.get).toHaveBeenCalled()
})
