import axios from 'axios'
import * as example from '../src/example'
import * as moduleA from '../src/moduleA'

vi
  .mock('../src/example', () => ({
    mocked: true,
  }))

// doesn't think comments are mocks
// vi.mock('../src/example', () => ({
//   mocked: false,
// }))

vi.mock('../src/moduleA', async() => {
  const actual = await vi.importActual<any>('../src/moduleA')
  return {
    B: 'B',
    ...actual,
  }
})

vi.mock('axios', () => {
  return {
    default: {
      get: vi.fn(),
    },
  }
})

describe('mocking with factory', () => {
  test('successfuly mocked', () => {
    expect((example as any).mocked).toBe(true)
    expect(example.boolean).toBeUndefined()
  })

  test('successfuly with actual', () => {
    expect(moduleA.A).toBe('A')
    expect((moduleA as any).B).toBe('B')
  })

  test('mocks node_modules', () => {
    axios.get('./path')

    expect(axios.get).toHaveBeenCalledTimes(1)
  })
})
