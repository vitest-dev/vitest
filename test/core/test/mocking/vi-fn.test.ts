import type { MockContext } from 'vitest'
import { describe, expect, test, vi } from 'vitest'

test('vi.fn() returns undefined by default', () => {
  const mock = vi.fn()
  expect(mock()).toBe(undefined)
})

test('vi.fn() calls implementation if it was passed down', () => {
  const mock = vi.fn(() => 3)
  expect(mock()).toBe(3)
})

test('vi.fn().mock cannot be overriden', () => {
  const mock = vi.fn()
  expect(() => mock.mock = {} as any).toThrowError()
  expect(() => {
    // @ts-expect-error mock is not optional
    delete mock.mock
  }).toThrowError()
})

describe('vi.fn() state', () => {
  // TODO: test when calls is not empty
  test('vi.fn() clears calls without a custom implementation', () => {
    const mock = vi.fn()
    const state = mock.mock

    assertStateEmpty(state)

    mock()

    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: undefined }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: undefined }])
    expect(state.contexts).toEqual([undefined])
    expect(state.instances).toEqual([undefined])
    expect(state.lastCall).toEqual([])

    mock.mockClear()

    assertStateEmpty(state)

    mock()

    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: undefined }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: undefined }])
    expect(state.contexts).toEqual([undefined])
    expect(state.instances).toEqual([undefined])
    expect(state.lastCall).toEqual([])

    vi.clearAllMocks()

    assertStateEmpty(state)
  })

  test('vi.fn() clears calls with a custom sync function implementation', () => {
    const mock = vi.fn(() => 42)
    const state = mock.mock

    assertStateEmpty(state)

    mock()

    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: 42 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 42 }])
    expect(state.contexts).toEqual([undefined])
    expect(state.instances).toEqual([undefined])
    expect(state.lastCall).toEqual([])

    mock.mockClear()

    assertStateEmpty(state)

    mock()

    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: 42 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 42 }])
    expect(state.contexts).toEqual([undefined])
    expect(state.instances).toEqual([undefined])
    expect(state.lastCall).toEqual([])

    vi.clearAllMocks()

    assertStateEmpty(state)
  })

  test('vi.fn() clears calls with a custom sync function implementation with context', () => {
    const mock = vi.fn(() => 42)
    const state = mock.mock

    assertStateEmpty(state)

    mock.call('context')

    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: 42 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 42 }])
    expect(state.contexts).toEqual(['context'])
    expect(state.instances).toEqual(['context'])
    expect(state.lastCall).toEqual([])

    mock.mockClear()

    assertStateEmpty(state)

    mock.call('context')

    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: 42 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 42 }])
    expect(state.contexts).toEqual(['context'])
    expect(state.instances).toEqual(['context'])
    expect(state.lastCall).toEqual([])

    vi.clearAllMocks()

    assertStateEmpty(state)
  })

  test('vi.fn() clears calls with a custom sync prototype function implementation', () => {
    const mock = vi.fn(function (this: any) {
      this.value = 42
      return 'return-string'
    })
    const state = mock.mock

    assertStateEmpty(state)

    mock.call({})

    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: 'return-string' }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 'return-string' }])
    expect(state.contexts).toEqual([{ value: 42 }])
    expect(state.instances).toEqual([{ value: 42 }])
    expect(state.lastCall).toEqual([])

    mock.mockClear()

    assertStateEmpty(state)

    mock.call({})

    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: 'return-string' }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 'return-string' }])
    expect(state.contexts).toEqual([{ value: 42 }])
    expect(state.instances).toEqual([{ value: 42 }])
    expect(state.lastCall).toEqual([])

    vi.clearAllMocks()

    assertStateEmpty(state)
  })

  test('vi.fn() clears calls with a custom sync class implementation', () => {
    const Mock = vi.fn(class {
      public value: number
      constructor() {
        this.value = 42
      }
    })
    const state = Mock.mock

    assertStateEmpty(state)

    const mock1 = new Mock()

    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: expect.any(Mock) }])
    expect(state.results).toEqual([{ type: 'return', value: { value: 42 } }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: { value: 42 } }])
    expect(state.contexts).toEqual([mock1])
    expect(state.instances).toEqual([mock1])
    expect(state.lastCall).toEqual([])

    Mock.mockClear()

    assertStateEmpty(state)

    const mock2 = new Mock()

    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: mock2 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: mock2 }])
    expect(state.contexts).toEqual([mock2])
    expect(state.instances).toEqual([mock2])
    expect(state.lastCall).toEqual([])

    vi.clearAllMocks()

    assertStateEmpty(state)
  })

  test('vi.fn() clears calls with a custom async function implementation', async () => {
    const mock = vi.fn(() => Promise.resolve(42))
    const state = mock.mock

    assertStateEmpty(state)

    const promise = mock()

    expect(state.calls).toEqual([[]])
    expect(state.settledResults).toEqual([{ type: 'incomplete', value: undefined }])
    expect(state.results).toEqual([{ type: 'return', value: expect.any(Promise) }])
    expect(state.contexts).toEqual([undefined])
    expect(state.instances).toEqual([undefined])
    expect(state.lastCall).toEqual([])

    await promise

    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 42 }])

    mock.mockClear()

    assertStateEmpty(state)

    const promise2 = mock()

    expect(state.calls).toEqual([[]])
    expect(state.settledResults).toEqual([{ type: 'incomplete', value: undefined }])
    expect(state.results).toEqual([{ type: 'return', value: expect.any(Promise) }])
    expect(state.contexts).toEqual([undefined])
    expect(state.instances).toEqual([undefined])
    expect(state.lastCall).toEqual([])

    await promise2

    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 42 }])

    vi.clearAllMocks()

    assertStateEmpty(state)
  })
})

describe('vi.fn() configuration', () => {
  test('vi.fn() resets the original mock implementation', () => {
    const mock = vi.fn(() => 42)
    expect(mock()).toBe(42)
    mock.mockReset()
    expect(mock()).toBe(42)
  })

  test('vi.fn() resets the mock implementation', () => {
    const mock = vi.fn().mockImplementation(() => 42)
    expect(mock()).toBe(42)
    mock.mockReset()
    expect(mock()).toBe(undefined)
  })

  test('vi.fn() returns undefined as a mock implementation', () => {
    const mock = vi.fn()
    expect(mock.getMockImplementation()).toBe(undefined)
  })

  test('vi.fn() returns implementation if it was set', () => {
    const implementation = () => 42
    const mock = vi.fn(implementation)
    expect(mock.getMockImplementation()).toBe(implementation)
  })

  test('vi.fn() returns mockImplementation if it was set', () => {
    const implementation = () => 42
    const mock = vi.fn().mockImplementation(implementation)
    expect(mock.getMockImplementation()).toBe(implementation)
  })

  test('vi.fn() returns mockOnceImplementation if it was set', () => {
    const implementation = () => 42
    const mock = vi.fn().mockImplementationOnce(implementation)
    expect(mock.getMockImplementation()).toBe(implementation)
  })

  test('vi.fn() returns withImplementation if it was set', () => {
    const implementation = () => 42
    const mock = vi.fn()
    mock.withImplementation(implementation, () => {
      expect(mock.getMockImplementation()).toBe(implementation)
    })
  })

  test('vi.fn() has a name', () => {
    const mock = vi.fn()
    expect(mock.getMockName()).toBe('vi.fn()')
    mock.mockName('test')
    expect(mock.getMockName()).toBe('test')
    mock.mockReset()
    expect(mock.getMockName()).toBe('vi.fn()')
    mock.mockName('test')
    expect(mock.getMockName()).toBe('test')
    vi.resetAllMocks()
    expect(mock.getMockName()).toBe('vi.fn()')
  })

  test('vi.fn() can reassign different implementations', () => {
    const mock = vi.fn(() => 42)
    expect(mock()).toBe(42)
    mock.mockReturnValueOnce(100)
      .mockReturnValueOnce(55)
    expect(mock()).toBe(100)
    expect(mock()).toBe(55)
    expect(mock()).toBe(42)
    mock.mockReturnValue(66)
    expect(mock()).toBe(66)
  })
})

describe('vi.fn() restoration', () => {
  test('vi.fn() resets the original implementation in mock.mockRestore()', () => {
    const mock = vi.fn(() => 'hello')
    expect(mock()).toBe('hello')
    mock.mockRestore()
    expect(mock()).toBe('hello')
  })

  test('vi.fn() doesn\'t resets the added implementation in mock.mockRestore()', () => {
    const mock = vi.fn().mockImplementation(() => 'hello')
    expect(mock()).toBe('hello')
    mock.mockRestore()
    expect(mock()).toBe(undefined)
  })

  test('vi.fn() doesn\'t restore the original implementation in vi.restoreAllMocks()', () => {
    const mock = vi.fn(() => 'hello')
    expect(mock()).toBe('hello')
    vi.restoreAllMocks()
    expect(mock()).toBe('hello')
  })

  test('vi.fn() doesn\'t restore the added implementation in vi.restoreAllMocks()', () => {
    const mock = vi.fn().mockImplementation(() => 'hello')
    expect(mock()).toBe('hello')
    vi.restoreAllMocks()
    expect(mock()).toBe('hello')
  })
})

describe('vi.fn() implementations', () => {
  test('vi.fn() can throw an error in original implementation', () => {
    const mock = vi.fn(() => {
      throw new Error('hello world')
    })

    expect(() => mock()).toThrowError('hello world')
    expect(mock.mock.results).toEqual([
      { type: 'throw', value: new Error('hello world') },
    ])
  })

  test('vi.fn() can throw an error in custom implementation', () => {
    const mock = vi.fn().mockImplementation(() => {
      throw new Error('hello world')
    })

    expect(() => mock()).toThrowError('hello world')
    expect(mock.mock.results).toEqual([
      { type: 'throw', value: new Error('hello world') },
    ])
  })

  test('vi.fn() with mockReturnThis on a function', () => {
    const context = {}
    const mock = vi.fn()
    mock.mockReturnThis()
    expect(mock.call(context)).toBe(context)
  })

  test('vi.fn() with mockReturnThis on a class', () => {
    const Mock = vi.fn(class {})
    Mock.mockReturnThis()
    const mock = new Mock()
    expect(mock, 'has no effect on return value').toBeInstanceOf(Mock)
    expect(Mock.mock.contexts).toEqual([mock])
    expect(Mock.mock.instances).toEqual([mock])
  })

  test('vi.fn() with mockReturnValue', () => {
    const mock = vi.fn()
    mock.mockReturnValue(42)
    expect(mock()).toBe(42)
    expect(mock()).toBe(42)
    expect(mock()).toBe(42)
    mock.mockReset()
    expect(mock()).toBe(undefined)
  })

  test('vi.fn() with mockReturnValue overriding original mock', () => {
    const mock = vi.fn(() => 42)
    mock.mockReturnValue(100)
    expect(mock()).toBe(100)
    expect(mock()).toBe(100)
    expect(mock()).toBe(100)
    mock.mockReset()
    expect(mock()).toBe(42)
  })

  test('vi.fn() with mockReturnValue overriding another mock', () => {
    const mock = vi.fn().mockImplementation(() => 42)
    mock.mockReturnValue(100)
    expect(mock()).toBe(100)
    expect(mock()).toBe(100)
    expect(mock()).toBe(100)
    mock.mockReset()
    expect(mock()).toBe(undefined)
  })

  test('vi.fn() with mockReturnValueOnce', () => {
    const mock = vi.fn()
    mock.mockReturnValueOnce(42)
    expect(mock()).toBe(42)
    expect(mock()).toBe(undefined)
    expect(mock()).toBe(undefined)
    mock.mockReturnValueOnce(42)
    mock.mockReset()
    expect(mock()).toBe(undefined)
  })

  test('vi.fn() with mockReturnValueOnce overriding original mock', () => {
    const mock = vi.fn(() => 42)
    mock.mockReturnValueOnce(100)
    expect(mock()).toBe(100)
    expect(mock()).toBe(42)
    expect(mock()).toBe(42)
    mock.mockReset()
    expect(mock()).toBe(42)
  })

  test('vi.fn() with mockReturnValueOnce overriding another mock', () => {
    const mock = vi.fn().mockImplementation(() => 42)
    mock.mockReturnValueOnce(100)
    expect(mock()).toBe(100)
    expect(mock()).toBe(42)
    expect(mock()).toBe(42)
    mock.mockReset()
    expect(mock()).toBe(undefined)
  })

  test('vi.fn() with mockResolvedValue', async () => {
    const mock = vi.fn()
    mock.mockResolvedValue(42)
    await expect(mock()).resolves.toBe(42)
    await expect(mock()).resolves.toBe(42)
    await expect(mock()).resolves.toBe(42)
    expect(mock.mock.settledResults).toEqual([
      { type: 'fulfilled', value: 42 },
      { type: 'fulfilled', value: 42 },
      { type: 'fulfilled', value: 42 },
    ])
    mock.mockReset()
    expect(mock()).toBe(undefined)
  })

  test('vi.fn() with mockResolvedValue overriding original mock', async () => {
    const mock = vi.fn(() => Promise.resolve(42))
    mock.mockResolvedValue(100)
    await expect(mock()).resolves.toBe(100)
    await expect(mock()).resolves.toBe(100)
    await expect(mock()).resolves.toBe(100)
    expect(mock.mock.settledResults).toEqual([
      { type: 'fulfilled', value: 100 },
      { type: 'fulfilled', value: 100 },
      { type: 'fulfilled', value: 100 },
    ])
    mock.mockReset()
    await expect(mock()).resolves.toBe(42)
  })

  test('vi.fn() with mockResolvedValue overriding another mock', async () => {
    const mock = vi.fn().mockImplementation(() => 42)
    mock.mockResolvedValue(100)
    await expect(mock()).resolves.toBe(100)
    await expect(mock()).resolves.toBe(100)
    await expect(mock()).resolves.toBe(100)
    expect(mock.mock.settledResults).toEqual([
      { type: 'fulfilled', value: 100 },
      { type: 'fulfilled', value: 100 },
      { type: 'fulfilled', value: 100 },
    ])
    mock.mockReset()
    expect(mock()).toBe(undefined)
  })

  test('vi.fn() with mockResolvedValueOnce', async () => {
    const mock = vi.fn()
    mock.mockResolvedValueOnce(42)
    await expect(mock()).resolves.toBe(42)
    expect(mock()).toBe(undefined)
    expect(mock()).toBe(undefined)
    mock.mockResolvedValueOnce(42)
    mock.mockReset()
    expect(mock()).toBe(undefined)
  })

  test('vi.fn() with mockResolvedValueOnce overriding original mock', async () => {
    const mock = vi.fn(() => Promise.resolve(42))
    mock.mockResolvedValueOnce(100)
    await expect(mock()).resolves.toBe(100)
    await expect(mock()).resolves.toBe(42)
    await expect(mock()).resolves.toBe(42)
    mock.mockReset()
    await expect(mock()).resolves.toBe(42)
  })

  test('vi.fn() with mockResolvedValueOnce overriding another mock', async () => {
    const mock = vi.fn().mockImplementation(() => Promise.resolve(42))
    mock.mockResolvedValueOnce(100)
    await expect(mock()).resolves.toBe(100)
    await expect(mock()).resolves.toBe(42)
    await expect(mock()).resolves.toBe(42)
    mock.mockReset()
    expect(mock()).toBe(undefined)
  })

  test('vi.fn() with mockRejectedValue', async () => {
    const mock = vi.fn()
    mock.mockRejectedValue(42)
    await expect(mock()).rejects.toBe(42)
    await expect(mock()).rejects.toBe(42)
    await expect(mock()).rejects.toBe(42)
    expect(mock.mock.settledResults).toEqual([
      { type: 'rejected', value: 42 },
      { type: 'rejected', value: 42 },
      { type: 'rejected', value: 42 },
    ])
    mock.mockReset()
    expect(mock()).toBe(undefined)
  })

  test('vi.fn() with mockRejectedValue overriding original mock', async () => {
    const mock = vi.fn(() => Promise.resolve(42))
    mock.mockRejectedValue(100)
    await expect(mock()).rejects.toBe(100)
    await expect(mock()).rejects.toBe(100)
    await expect(mock()).rejects.toBe(100)
    expect(mock.mock.settledResults).toEqual([
      { type: 'rejected', value: 100 },
      { type: 'rejected', value: 100 },
      { type: 'rejected', value: 100 },
    ])
    mock.mockReset()
    await expect(mock()).resolves.toBe(42)
  })

  test('vi.fn() with mockRejectedValue overriding another mock', async () => {
    const mock = vi.fn().mockImplementation(() => Promise.resolve(42))
    mock.mockRejectedValue(100)
    await expect(mock()).rejects.toBe(100)
    await expect(mock()).rejects.toBe(100)
    await expect(mock()).rejects.toBe(100)
    expect(mock.mock.settledResults).toEqual([
      { type: 'rejected', value: 100 },
      { type: 'rejected', value: 100 },
      { type: 'rejected', value: 100 },
    ])
    mock.mockReset()
    expect(mock()).toBe(undefined)
  })

  test('vi.fn() with mockRejectedValueOnce', async () => {
    const mock = vi.fn()
    mock.mockRejectedValueOnce(42)
    await expect(mock()).rejects.toBe(42)
    expect(mock()).toBe(undefined)
    expect(mock()).toBe(undefined)
    mock.mockRejectedValueOnce(42)
    mock.mockReset()
    expect(mock()).toBe(undefined)
  })

  test('vi.fn() with mockRejectedValueOnce overriding original mock', async () => {
    const mock = vi.fn(() => Promise.resolve(42))
    mock.mockRejectedValueOnce(100)
    await expect(mock()).rejects.toBe(100)
    await expect(mock()).resolves.toBe(42)
    await expect(mock()).resolves.toBe(42)
    mock.mockReset()
    await expect(mock()).resolves.toBe(42)
  })

  test('vi.fn() with mockRejectedValueOnce overriding another mock', async () => {
    const mock = vi.fn().mockImplementation(() => Promise.resolve(42))
    mock.mockRejectedValueOnce(100)
    await expect(mock()).rejects.toBe(100)
    await expect(mock()).resolves.toBe(42)
    await expect(mock()).resolves.toBe(42)
    mock.mockReset()
    expect(mock()).toBe(undefined)
  })

  test('vi.fn() throws an error if new is called on arrow function', ({ onTestFinished }) => {
    const log = vi.spyOn(console, 'warn')
    onTestFinished(() => log.mockRestore())
    const Mock = vi.fn(() => {})
    expect(() => new Mock()).toThrowError()
    expect(log).toHaveBeenCalledWith(
      `[vitest] The vi.fn() mock did not use 'function' or 'class' in its implementation, see https://vitest.dev/api/vi#vi-spyon for examples.`,
    )
  })

  test('vi.fn() throws an error if new is not called on a class', () => {
    const Mock = vi.fn(class _Mock {})
    expect(() => Mock()).toThrowError(
      `Class constructor _Mock cannot be invoked without 'new'`,
    )
  })

  test('vi.fn() respects new target in a function', () => {
    let target!: unknown
    let callArgs!: unknown[]
    const Mock = vi.fn(function (this: any, ...args: unknown[]) {
      target = new.target
      callArgs = args
    })
    const _example = new Mock('test', 42)
    expect(target).toBeTypeOf('function')
    expect(callArgs).toEqual(['test', 42])
    expect(Mock.mock.calls).toEqual([['test', 42]])
  })

  test('vi.fn() respects new target in a class', () => {
    let target!: unknown
    let callArgs!: unknown[]
    const Mock = vi.fn(class {
      constructor(...args: any[]) {
        target = new.target
        callArgs = args
      }
    })
    const _example = new Mock('test', 42)
    expect(target).toBeTypeOf('function')
    expect(callArgs).toEqual(['test', 42])
    expect(Mock.mock.calls).toEqual([['test', 42]])
  })
})

function assertStateEmpty(state: MockContext<any>) {
  expect(state.calls).toHaveLength(0)
  expect(state.results).toHaveLength(0)
  expect(state.settledResults).toHaveLength(0)
  expect(state.contexts).toHaveLength(0)
  expect(state.instances).toHaveLength(0)
  expect(state.lastCall).toBe(undefined)
  expect(state.invocationCallOrder).toEqual([])
}
