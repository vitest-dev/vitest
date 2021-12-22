import * as example from '../src/example'
import * as moduleA from '../src/moduleA'

vi.mock('../src/example', () => ({
  mocked: true,
}))

vi.mock('../src/moduleA', async() => {
  const actual = await vi.importActual<any>('../src/moduleA')
  return {
    B: 'B',
    ...actual,
  }
})

describe('mocking with factory', () => {
  test('successfuly mocked', () => {
    expect((example as any).mocked).toBe(true)
  })

  test('successfuly with actual', () => {
    expect(moduleA.A).toBe('A')
    expect((moduleA as any).B).toBe('B')
  })
})
