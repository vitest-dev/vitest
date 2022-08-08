import axios from 'axios'
import * as example from '../src/example'
import * as moduleA from '../src/moduleA'
import logger from '../src/log'

vi
  .mock('../src/example', () => ({
    mocked: true,
    then: 'a then export',
    square: (a: any, b: any) => a + b,
    asyncSquare: async (a: any, b: any) => Promise.resolve(a + b),
  }))

// doesn't think comments are mocks
// vi.mock('../src/example', () => ({
//   mocked: false,
// }))

vi.mock('../src/moduleA', async () => {
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

vi.mock('../src/log.ts', async () => {
  // can import the same module inside and does not go into an infinite loop
  const log = await import('../src/log')
  return {
    default: {
      ...log.default,
      info: vi.fn(),
    },
  }
})

vi.mock('../src/default', () => 'a new default')

describe('mocking with factory', () => {
  test('missing exports on mock', () => {
    expect(() => example.default).toThrowError('[vitest] No "default" export is defined on the "mock:/src/example.ts"')
    expect(() => example.boolean).toThrowError('[vitest] No "boolean" export is defined on the "mock:/src/example.ts"')
    expect(() => example.object).toThrowError('[vitest] No "object" export is defined on the "mock:/src/example.ts"')
    expect(() => example.array).toThrowError('[vitest] No "array" export is defined on the "mock:/src/example.ts"')
    expect(() => example.someClasses).toThrowError('[vitest] No "someClasses" export is defined on the "mock:/src/example.ts"')
  })

  test('missing object return on factory gives error', async () => {
    await expect(() => import('../src/default').then(m => m.default)).rejects
      .toThrowError('[vitest] vi.mock("../src/default", factory?: () => unknown) is not returning an object. Did you mean to return an object with a "default" key?')
  })

  test('defined exports on mock', async () => {
    expect((example as any).then).toBe('a then export')
    expect((example as any).mocked).toBe(true)
    expect(example.square(2, 3)).toBe(5)
    expect(example.asyncSquare(2, 3)).resolves.toBe(5)
  })

  test('successfuly with actual', () => {
    expect(moduleA.A).toBe('A')
    expect((moduleA as any).B).toBe('B')
  })

  test('mocks node_modules', () => {
    axios.get('./path')

    expect(axios.get).toHaveBeenCalledTimes(1)
  })

  test('logger extended', () => {
    expect(logger.warn).toBeTypeOf('function')
    // @ts-expect-error extending module
    expect(logger.info).toBeTypeOf('function')
  })
})
