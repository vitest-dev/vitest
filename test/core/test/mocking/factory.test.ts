import axios from 'axios'
import { describe, expect, it, test, vi } from 'vitest'
import * as example from '../../src/mocks/example'
import logger from '../../src/mocks/log'
import * as moduleA from '../../src/mocks/moduleA'
import * as moduleB from '../../src/mocks/moduleB'

vi
  .mock('../../src/mocks/example', () => ({
    mocked: true,
    then: 'a then export',
    ok: undefined,
    square: (a: any, b: any) => a + b,
    asyncSquare: async (a: any, b: any) => Promise.resolve(a + b),
  }))

// doesn't think comments are mocks
// vi.mock('../../src/mocks/example', () => ({
//   mocked: false,
// }))

vi.mock('../../src/mocks/moduleA', async () => {
  const actual = await vi.importActual<any>('../../src/mocks/moduleA')
  return {
    B: 'B',
    ...actual,
  }
})

vi.mock('../../src/mocks/moduleB', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    B: 'mockedB',
    C: 'addedC',
  }
})

vi.mock('axios', () => {
  return {
    default: {
      get: vi.fn(),
    },
  }
})

vi.mock('../../src/mocks/log.ts', async () => {
  // can import the same module inside and does not go into an infinite loop
  const log = await import('../../src/mocks/log')
  return {
    default: {
      ...log.default,
      info: vi.fn(),
    },
  }
})
// @ts-expect-error null is not allowed to mocked implementation
vi.mock('../../src/mocks/default.ts', () => null)

describe('mocking with factory', () => {
  test('missing exports on mock', () => {
    expect(() => example.default).toThrowError('[vitest] No "default" export is defined on the "../../src/mocks/example" mock')
    expect(() => example.boolean).toThrowError('[vitest] No "boolean" export is defined on the "../../src/mocks/example" mock')
    expect(() => example.object).toThrowError('[vitest] No "object" export is defined on the "../../src/mocks/example" mock')
    expect(() => example.array).toThrowError('[vitest] No "array" export is defined on the "../../src/mocks/example" mock')
    expect(() => example.someClasses).toThrowError('[vitest] No "someClasses" export is defined on the "../../src/mocks/example" mock')
  })

  it('non-object return on factory gives error', async () => {
    await expect(() => import('../../src/mocks/default.js').then(m => m.default)).rejects.toThrowError('[vitest] vi.mock("../../src/mocks/default.ts", factory?: () => unknown) is not returning an object. Did you mean to return an object with a "default" key?')
  })

  test('defined exports on mock', async () => {
    expect((example as any).ok).toBe(undefined)
    expect((example as any).then).toBe('a then export')
    expect((example as any).mocked).toBe(true)
    expect(example.square(2, 3)).toBe(5)
    await expect(example.asyncSquare(2, 3)).resolves.toBe(5)
  })

  test('successfully with actual', () => {
    expect(moduleA.A).toBe('A')
    expect((moduleA as any).B).toBe('B')
  })

  test('successfully with factory helper', () => {
    expect(moduleB.A).toBe('A')
    expect(moduleB.B).toBe('mockedB')
    expect((moduleB as any).C).toBe('addedC')
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
