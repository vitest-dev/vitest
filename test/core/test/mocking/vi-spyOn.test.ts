import type { MockContext } from 'vitest'
import { describe, expect, test, vi } from 'vitest'

describe('vi.spyOn() edge cases', () => {
  test('vi.spyOn() has correct length', () => {
    const fn0 = vi.spyOn({ fn: () => {} }, 'fn')
    expect(fn0.length).toBe(0)

    const fnArgs = vi.spyOn({ fn: (..._args: any[]) => {} }, 'fn')
    expect(fnArgs.length).toBe(0)

    const fn1 = vi.spyOn({ fn: (_arg1: any) => {} }, 'fn')
    expect(fn1.length).toBe(1)

    const fn2 = vi.spyOn({ fn: (_arg1: any, _arg2: any) => {} }, 'fn')
    expect(fn2.length).toBe(2)

    const fn3 = vi.spyOn({ fn: (_arg1: any, _arg2: any, _arg3: any) => {} }, 'fn')
    expect(fn3.length).toBe(3)
  })

  test('can spy on a proxy with undefined descriptor\'s value', () => {
    const obj = new Proxy<{ fn: () => number }>({} as any, {
      get(_, prop) {
        if (prop === 'fn') {
          return () => 42
        }
      },
      getOwnPropertyDescriptor(_, prop) {
        if (prop === 'fn') {
          return {
            configurable: true,
            enumerable: true,
            value: undefined,
            writable: true,
          }
        }
      },
    })
    const spy = vi.spyOn(obj, 'fn')
    expect(spy()).toBe(42)
  })

  describe('vi.spyOn() copies static properties', () => {
    test('vi.spyOn() copies properties from functions', () => {
      function a() {}
      a.HELLO_WORLD = true
      const obj = {
        a,
      }

      const spy = vi.spyOn(obj, 'a')

      expect(obj.a.HELLO_WORLD).toBe(true)
      expect(spy.HELLO_WORLD).toBe(true)
    })

    test('vi.spyOn() copies properties from classes', () => {
      class A {
        static HELLO_WORLD = true
      }
      const obj = {
        A,
      }

      const spy = vi.spyOn(obj, 'A')

      expect(obj.A.HELLO_WORLD).toBe(true)
      expect(spy.HELLO_WORLD).toBe(true)
    })

    test('vi.spyOn() ignores node.js.promisify symbol', () => {
      const promisifySymbol = Symbol.for('nodejs.util.promisify.custom')
      class Example {
        static [promisifySymbol] = () => Promise.resolve(42)
      }
      const obj = { Example }

      const spy = vi.spyOn(obj, 'Example')

      expect(spy[promisifySymbol]).toBe(undefined)
    })
  })
})

describe('vi.spyOn() state', () => {
  test('vi.spyOn() spies on an object and tracks the calls', () => {
    const object = createObject()
    const mock = vi.spyOn(object, 'method')

    expect(object.method).toBe(mock)
    expect(vi.isMockFunction(object.method)).toBe(true)

    const state = mock.mock

    assertStateEmpty(state)

    object.method()
    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: 42 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 42 }])
    expect(state.instances).toEqual([object])
    expect(state.contexts).toEqual([object])
    expect(state.lastCall).toEqual([])
    expect(state.invocationCallOrder).toEqual([expect.any(Number)])

    mock.mockClear()
    assertStateEmpty(state)

    object.method()
    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: 42 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 42 }])
    expect(state.instances).toEqual([object])
    expect(state.contexts).toEqual([object])
    expect(state.lastCall).toEqual([])
    expect(state.invocationCallOrder).toEqual([expect.any(Number)])

    vi.clearAllMocks()
    assertStateEmpty(state)
  })

  test('vi.spyOn() spies and tracks overriden sync calls', () => {
    const object = createObject()
    const mock = vi.spyOn(object, 'method')
    mock.mockImplementation(() => 100)
    const state = mock.mock

    assertStateEmpty(state)

    object.method()
    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: 100 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 100 }])
    expect(state.instances).toEqual([object])
    expect(state.contexts).toEqual([object])
    expect(state.lastCall).toEqual([])
    expect(state.invocationCallOrder).toEqual([expect.any(Number)])

    mock.mockClear()
    assertStateEmpty(state)

    object.method()
    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: 100 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 100 }])
    expect(state.instances).toEqual([object])
    expect(state.contexts).toEqual([object])
    expect(state.lastCall).toEqual([])
    expect(state.invocationCallOrder).toEqual([expect.any(Number)])

    vi.clearAllMocks()
    assertStateEmpty(state)
  })

  test('vi.spyOn() spies and tracks overriden sync calls with context', () => {
    const object = createObject()
    const mock = vi.spyOn(object, 'method')
    mock.mockImplementation(() => 100)
    const state = mock.mock
    const context = {}

    assertStateEmpty(state)

    object.method.call(context)
    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: 100 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 100 }])
    expect(state.instances).toEqual([context])
    expect(state.contexts).toEqual([context])
    expect(state.lastCall).toEqual([])
    expect(state.invocationCallOrder).toEqual([expect.any(Number)])

    mock.mockClear()
    assertStateEmpty(state)

    object.method.call(context)
    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: 100 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 100 }])
    expect(state.instances).toEqual([context])
    expect(state.contexts).toEqual([context])
    expect(state.lastCall).toEqual([])
    expect(state.invocationCallOrder).toEqual([expect.any(Number)])

    vi.clearAllMocks()
    assertStateEmpty(state)
  })

  test('vi.spyOn() spies and tracks overriden sync prototype calls with context', () => {
    const object = createObject()
    const mock = vi.spyOn(object, 'method')
    mock.mockImplementation(function (this: any) {
      this.value = 42
      return 100
    })
    const state = mock.mock
    const context = {}

    assertStateEmpty(state)

    object.method.call(context)
    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: 100 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 100 }])
    expect(state.instances).toEqual([{ value: 42 }])
    expect(state.contexts).toEqual([{ value: 42 }])
    expect(state.lastCall).toEqual([])
    expect(state.invocationCallOrder).toEqual([expect.any(Number)])

    mock.mockClear()
    assertStateEmpty(state)

    object.method.call(context)
    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: 100 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 100 }])
    expect(state.instances).toEqual([{ value: 42 }])
    expect(state.contexts).toEqual([{ value: 42 }])
    expect(state.lastCall).toEqual([])
    expect(state.invocationCallOrder).toEqual([expect.any(Number)])

    vi.clearAllMocks()
    assertStateEmpty(state)
  })

  test('vi.spyOn() spies and tracks overriden sync class calls with context', () => {
    const object = createObject()
    const mock = vi.spyOn(object, 'Class')
    mock.mockImplementation(class {
      public value: number
      constructor() {
        this.value = 42
      }
    })
    const state = mock.mock

    assertStateEmpty(state)

    const instance1 = new object.Class()
    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: instance1 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: instance1 }])
    expect(state.instances).toEqual([instance1])
    expect(state.contexts).toEqual([instance1])
    expect(state.lastCall).toEqual([])
    expect(state.invocationCallOrder).toEqual([expect.any(Number)])

    mock.mockClear()
    assertStateEmpty(state)

    const instance2 = new object.Class()
    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: instance2 }])
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: instance2 }])
    expect(state.instances).toEqual([instance2])
    expect(state.contexts).toEqual([instance2])
    expect(state.lastCall).toEqual([])
    expect(state.invocationCallOrder).toEqual([expect.any(Number)])

    vi.clearAllMocks()
    assertStateEmpty(state)
  })

  test('vi.spyOn() spies and tracks overriden async calls', async () => {
    const object = createObject()
    const mock = vi.spyOn(object, 'async')
    mock.mockImplementation(() => Promise.resolve(100))
    const state = mock.mock

    assertStateEmpty(state)

    const promise1 = object.async()
    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: expect.any(Promise) }])
    expect(state.settledResults).toEqual([{ type: 'incomplete', value: undefined }])
    expect(state.instances).toEqual([object])
    expect(state.contexts).toEqual([object])
    expect(state.lastCall).toEqual([])
    expect(state.invocationCallOrder).toEqual([expect.any(Number)])

    await promise1
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 100 }])

    mock.mockClear()
    assertStateEmpty(state)

    const promise2 = object.async()
    expect(state.calls).toEqual([[]])
    expect(state.results).toEqual([{ type: 'return', value: expect.any(Promise) }])
    expect(state.settledResults).toEqual([{ type: 'incomplete', value: undefined }])
    expect(state.instances).toEqual([object])
    expect(state.contexts).toEqual([object])
    expect(state.lastCall).toEqual([])
    expect(state.invocationCallOrder).toEqual([expect.any(Number)])

    await promise2
    expect(state.settledResults).toEqual([{ type: 'fulfilled', value: 100 }])

    vi.clearAllMocks()
    assertStateEmpty(state)
  })

  test('vi.spyOn() doesn\'t loose context', () => {
    const instances: any[] = []
    const Names = function Names(this: any) {
      instances.push(this)
      this.array = [1]
    } as {
      (): void
      new (): typeof obj
    }
    const obj = {
      array: [],
      Names,
    }

    vi.spyOn(obj, 'Names')

    const s = new obj.Names()

    expect(obj.array).toEqual([])
    expect(s.array).toEqual([1])
    expect(instances[0]).toEqual({ array: [1] })

    obj.Names()

    expect(obj.array).toEqual([1])
  })
})

describe('vi.spyOn() settings', () => {
  test('vi.spyOn() when spying on a method spy returns the same spy', () => {
    const object = createObject()
    const spy1 = vi.spyOn(object, 'method')
    const spy2 = vi.spyOn(object, 'method')
    expect(spy1).toBe(spy2)

    object.method()
    expect(spy2.mock.calls).toEqual(spy2.mock.calls)
  })

  test('vi.spyOn() when spying on a getter spy returns the same spy', () => {
    const object = createObject()
    const spy1 = vi.spyOn(object, 'getter', 'get')
    const spy2 = vi.spyOn(object, 'getter', 'get')
    expect(spy1).toBe(spy2)

    const _example = object.getter
    expect(spy2).toHaveBeenCalledTimes(1)
    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2.mock.calls).toEqual(spy1.mock.calls)
  })

  test('vi.spyOn() when spying on a setter spy returns the same spy', () => {
    const object = createObject()
    const spy1 = vi.spyOn(object, 'getter', 'set')
    const spy2 = vi.spyOn(object, 'getter', 'set')
    expect(spy1).toBe(spy2)

    object.getter = 33
    expect(spy2).toHaveBeenCalledTimes(1)
    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2.mock.calls).toEqual(spy1.mock.calls)
  })

  test('vi.spyOn() when spying on a static getter spy returns the same spy', () => {
    const object = createObject()
    const spy1 = vi.spyOn(object, 'static', 'get')
    const spy2 = vi.spyOn(object, 'static', 'get')
    expect(spy1).toBe(spy2)

    const _example = object.static
    expect(spy2).toHaveBeenCalledTimes(1)
    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2.mock.calls).toEqual(spy1.mock.calls)
  })

  test('vi.spyOn() when spying on a static setter spy returns the same spy', () => {
    const object = createObject()
    const spy1 = vi.spyOn(object, 'static', 'set')
    const spy2 = vi.spyOn(object, 'static', 'set')
    expect(spy1).toBe(spy2)

    object.static = 33
    expect(spy2).toHaveBeenCalledTimes(1)
    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2.mock.calls).toEqual(spy1.mock.calls)
  })

  test('vi.spyOn() can spy on multiple class instances without intervention', () => {
    class Example {
      method() {
        return 42
      }
    }

    const example1 = new Example()
    const example2 = new Example()

    const mock1 = vi.spyOn(example1, 'method')
    const mock2 = vi.spyOn(example2, 'method')

    example1.method()
    expect(mock1.mock.calls).toHaveLength(1)
    expect(mock2.mock.calls).toHaveLength(0)

    example1.method()
    expect(mock1.mock.calls).toHaveLength(2)
    expect(mock2.mock.calls).toHaveLength(0)

    example2.method()
    expect(mock1.mock.calls).toHaveLength(2)
    expect(mock2.mock.calls).toHaveLength(1)
  })

  test('vi.spyOn() can spy on a prototype', () => {
    class Example {
      method() {
        return 42
      }
    }

    const example = new Example()
    const spy = vi.spyOn(example, 'method')
    expect(example.method()).toBe(42)
    expect(spy.mock.calls).toEqual([[]])
    expect(vi.isMockFunction(Example.prototype.method)).toBe(false)
  })

  test('vi.spyOn() can spy on inherited methods', () => {
    class Bar {
      _bar = 'bar'
      get bar(): string {
        return this._bar
      }

      set bar(bar: string) {
        this._bar = bar
      }
    }
    class Foo extends Bar {}
    const foo = new Foo()
    vi.spyOn(foo, 'bar', 'get').mockImplementation(() => 'foo')
    expect(foo.bar).toEqual('foo')
    // foo.bar setter is inherited from Bar, so we can set it
    expect(() => {
      foo.bar = 'baz'
    }).not.toThrow()
    expect(foo.bar).toEqual('foo')
  })

  test('vi.spyOn() inherits overriden methods', () => {
    class Bar {
      _bar = 'bar'
      get bar(): string {
        return this._bar
      }

      set bar(bar: string) {
        this._bar = bar
      }
    }
    class Foo extends Bar {
      get bar(): string {
        return `${super.bar}-foo`
      }
    }
    const foo = new Foo()
    expect(foo.bar).toEqual('bar-foo')
    vi.spyOn(foo, 'bar', 'get').mockImplementation(() => 'foo')
    expect(foo.bar).toEqual('foo')
    // foo.bar setter is not inherited from Bar
    expect(() => {
      // @ts-expect-error bar cannot be overriden
      foo.bar = 'baz'
    }).toThrow()
    expect(foo.bar).toEqual('foo')
  })

  test('vi.spyOn().mockReset() resets the implementation', () => {
    const object = createObject()
    const spy = vi.spyOn(object, 'method').mockImplementation(() => 100)
    expect(object.method()).toBe(100)
    spy.mockReset()
    expect(object.method()).toBe(42)
  })

  test('vi.spyOn() resets the implementation in resetAllMocks', () => {
    const object = createObject()
    vi.spyOn(object, 'method').mockImplementation(() => 100)
    expect(object.method()).toBe(100)
    vi.resetAllMocks()
    expect(object.method()).toBe(42)
  })

  test('vi.spyOn() returns undefined as mockImplementation', () => {
    const object = createObject()
    const spy = vi.spyOn(object, 'method')
    expect(spy.getMockImplementation()).toBe(undefined)
  })

  test('vi.spyOn() returns implementation if it was set', () => {
    const implementation = () => 42
    const object = createObject()
    const spy = vi.spyOn(object, 'method').mockImplementation(implementation)
    expect(spy.getMockImplementation()).toBe(implementation)
    spy.mockReset()
    expect(spy.getMockImplementation()).toBe(undefined)
  })

  test('vi.spyOn() returns mockOnceImplementation if it was set', () => {
    const implementation = () => 42
    const object = createObject()
    const spy = vi.spyOn(object, 'method').mockImplementationOnce(implementation)
    expect(spy.getMockImplementation()).toBe(implementation)
  })

  test('vi.spyOn() returns withImplementation if it was set', () => {
    const implementation = () => 42
    const object = createObject()
    const spy = vi.spyOn(object, 'method')
    spy.withImplementation(implementation, () => {
      expect(spy.getMockImplementation()).toBe(implementation)
    })
  })

  test('vi.spyOn() has a name', () => {
    const object = createObject()
    const spy = vi.spyOn(object, 'method')
    expect(spy.getMockName()).toBe('method')
    spy.mockName('test')
    expect(spy.getMockName()).toBe('test')
    spy.mockReset()
    expect(spy.getMockName()).toBe('method')
    spy.mockName('test')
    expect(spy.getMockName()).toBe('test')
    vi.resetAllMocks()
    expect(spy.getMockName()).toBe('method')
  })
})

describe('vi.spyOn() restoration', () => {
  test('vi.spyOn() cannot spy on undefined or null', () => {
    expect(() => vi.spyOn(undefined as any, 'test')).toThrow('The vi.spyOn() function could not find an object to spy upon. The first argument must be defined.')
    expect(() => vi.spyOn(null as any, 'test')).toThrow('The vi.spyOn() function could not find an object to spy upon. The first argument must be defined.')
  })

  test('vi.spyOn() cannot spy on a primitive value', () => {
    expect(() => vi.spyOn('string' as any, 'toString')).toThrow('Vitest cannot spy on a primitive value.')
    expect(() => vi.spyOn(0 as any, 'toString')).toThrow('Vitest cannot spy on a primitive value.')
    expect(() => vi.spyOn(true as any, 'toString')).toThrow('Vitest cannot spy on a primitive value.')
    expect(() => vi.spyOn(1n as any, 'toString')).toThrow('Vitest cannot spy on a primitive value.')
    expect(() => vi.spyOn(Symbol.toStringTag as any, 'toString')).toThrow('Vitest cannot spy on a primitive value.')
  })

  test('vi.spyOn() cannot spy on non-existing property', () => {
    expect(() => vi.spyOn({} as any, 'never')).toThrow('The property "never" is not defined on the object.')
  })

  test('vi.spyOn() restores the original method when .mockRestore() is called', () => {
    const object = createObject()
    const spy = vi.spyOn(object, 'method')
    object.method()
    expect(vi.isMockFunction(object.method)).toBe(true)
    expect(spy.mock.calls).toHaveLength(1)
    spy.mockRestore()
    expect(vi.isMockFunction(object.method)).toBe(false)
    expect(spy.mock.calls).toHaveLength(0)
  })

  test('vi.spyOn() restores the original method when vi.restoreAllMocks() is called', () => {
    const object = createObject()
    const spy = vi.spyOn(object, 'method')
    object.method()
    expect(vi.isMockFunction(object.method)).toBe(true)
    expect(spy.mock.calls).toHaveLength(1)
    vi.restoreAllMocks()
    expect(vi.isMockFunction(object.method)).toBe(false)
    // unlike vi.mockRestore(), the state is not cleared
    // this is important for module mocking
    expect(spy.mock.calls).toHaveLength(1)
  })

  test('vi.spyOn() can respy the metthod with new state when vi.restoreAllMocks() is called', () => {
    const object = createObject()
    const spy1 = vi.spyOn(object, 'method').mockImplementation(() => 100)

    expect(object.method()).toBe(100)
    expect(spy1.mock.calls).toHaveLength(1)
    vi.restoreAllMocks()

    const spy2 = vi.spyOn(object, 'method').mockImplementation(() => 33)
    expect(object.method()).toBe(33)
    expect(spy2.mock.calls).toHaveLength(1)
  })

  test('vi.spyOn() restores the original getter when .mockRestore() is called', () => {
    const object = createObject()
    const spy = vi.spyOn(object, 'getter', 'get').mockImplementation(() => 100)

    expect(object.getter).toBe(100)
    expect(spy.mock.calls).toHaveLength(1)
    spy.mockRestore()

    expect(spy.mock.calls).toHaveLength(0)
    expect(object.getter).toBe(42)
  })

  test('vi.spyOn() restores the original getter when vi.restoreAllMocks() is called', () => {
    const object = createObject()
    const spy = vi.spyOn(object, 'getter', 'get').mockImplementation(() => 100)

    expect(object.getter).toBe(100)
    expect(spy.mock.calls).toHaveLength(1)
    vi.restoreAllMocks()

    // unlike vi.mockRestore(), the state is not cleared
    // this is important for module mocking
    expect(spy.mock.calls).toHaveLength(1)
    expect(object.getter).toBe(42)
  })

  test('vi.spyOn() can respy the getter with new state when vi.restoreAllMocks() is called', () => {
    const object = createObject()
    const spy1 = vi.spyOn(object, 'getter', 'get').mockImplementation(() => 100)

    expect(object.getter).toBe(100)
    expect(spy1.mock.calls).toHaveLength(1)
    vi.restoreAllMocks()

    const spy2 = vi.spyOn(object, 'getter', 'get').mockImplementation(() => 33)
    expect(object.getter).toBe(33)
    expect(spy2.mock.calls).toHaveLength(1)
  })

  test('vi.spyOn() restores the original setter when .mockRestore() is called', () => {
    const object = createObject()
    const spy = vi.spyOn(object, 'getter', 'set').mockImplementation(() => {
      // do nothing
    })

    object.getter = 100

    expect(object.getter).toBe(42) // getter was not overriden
    expect(spy.mock.calls).toHaveLength(1)
    spy.mockRestore()

    object.getter = 33

    expect(spy.mock.calls).toHaveLength(0)
    expect(object.getter).toBe(33)
  })

  test('vi.spyOn() restores the original getter when vi.restoreAllMocks() is called', () => {
    const object = createObject()
    const spy = vi.spyOn(object, 'getter', 'set').mockImplementation(() => {
      // do nothing
    })

    object.getter = 100

    expect(object.getter).toBe(42) // getter was not overriden
    expect(spy.mock.calls).toHaveLength(1)
    vi.restoreAllMocks()

    // unlike vi.mockRestore(), the state is not cleared
    // this is important for module mocking
    expect(spy.mock.calls).toHaveLength(1)

    object.getter = 33

    expect(object.getter).toBe(33)
  })

  test('vi.spyOn() can respy the getter with new state when vi.restoreAllMocks() is called', () => {
    const object = createObject()
    const spy1 = vi.spyOn(object, 'getter', 'set').mockImplementation(() => {
      // do nothing
    })

    object.getter = 100

    expect(object.getter).toBe(42)
    expect(spy1.mock.calls).toHaveLength(1)
    vi.restoreAllMocks()

    let called = false
    const spy2 = vi.spyOn(object, 'getter', 'set').mockImplementation(() => {
      called = true
    })

    object.getter = 84

    expect(called).toBe(true)
    expect(object.getter).toBe(42)
    expect(spy2.mock.calls).toHaveLength(1)
  })
})

describe('vi.spyOn() on Vite SSR', () => {
  test('vi.spyOn() throws an error if a getter returns a non-function value in SSR', () => {
    const module = {
      get primitive() {
        return 42
      },
    }
    expect(() => {
      // @ts-expect-error types recognize it's not a function
      vi.spyOn(module, 'primitive')
    }).toThrow('vi.spyOn() can only spy on a function. Received number.')
  })

  test('vi.spyOn() assigns the method on a getter', () => {
    const method = () => {}
    const module = {
      get method() {
        return method
      },
    }
    const spy = vi.spyOn(module, 'method')
    expect(spy.getMockImplementation()).toBe(undefined)

    module.method()
    expect(spy.mock.calls).toEqual([[]])
    expect(module.method).toBe(spy)

    spy.mockRestore()
    expect(module.method).toBe(method)
  })

  test('vi.spyOn() can reassign the SSR getter method', () => {
    const method = () => {}
    const module = {
      get method() {
        return method
      },
    }
    const spy1 = vi.spyOn(module, 'method')
    const spy2 = vi.spyOn(module, 'method')
    expect(vi.isMockFunction(spy1)).toBe(true)
    expect(vi.isMockFunction(spy2)).toBe(true)
    expect(spy1).toBe(spy2)

    module.method()
    expect(spy1.mock.calls).toEqual([[]])
    expect(spy2.mock.calls).toEqual([[]])
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

function createObject() {
  let getterValue = 42
  return {
    Class: class {},
    method() {
      return 42
    },
    async() {
      return Promise.resolve(42)
    },
    get getter() {
      return getterValue
    },
    set getter(value: number) {
      getterValue = value
    },
    static: 42,
  }
}
