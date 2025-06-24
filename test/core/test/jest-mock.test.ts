import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { rolldownVersion } from 'vitest/node'

describe('jest mock compat layer', () => {
  const returnFactory = (type: string) => (value: any) => ({ type, value })

  const r = returnFactory('return')
  const e = returnFactory('throw')
  const f = returnFactory('fulfilled')
  const h = returnFactory('rejected')

  it('works with name', () => {
    const spy = vi.fn()
    spy.mockName('spy test name')
    expect(spy.getMockName()).toBe('spy test name')
  })

  it('clearing', () => {
    const spy = vi.fn()

    spy('hello')

    expect(spy.mock.calls).toHaveLength(1)
    expect(spy.mock.calls[0]).toEqual(['hello'])

    spy('world')
    expect(spy.mock.calls).toEqual([['hello'], ['world']])

    spy.mockReset() // same as mockClear()

    expect(spy.mock.calls).toEqual([])
  })

  it('clearing instances', () => {
    const Spy = vi.fn()

    expect(Spy.mock.instances).toHaveLength(0)
    const _result = new Spy()
    expect(Spy.mock.instances).toHaveLength(1)

    Spy.mockReset() // same as mockClear()

    expect(Spy.mock.instances).toHaveLength(0)
  })

  it('collects contexts', () => {
    // eslint-disable-next-line prefer-arrow-callback
    const Spy = vi.fn(function () {})

    expect(Spy.mock.contexts).toHaveLength(0)
    const ctx = new Spy()
    expect(Spy.mock.contexts).toHaveLength(1)
    expect(Spy.mock.contexts[0]).toBe(ctx)

    Spy.mockReset()

    expect(Spy.mock.contexts).toHaveLength(0)

    const ctx2 = {}
    Spy.call(ctx2)
    expect(Spy.mock.contexts).toHaveLength(1)
    expect(Spy.mock.contexts[0]).toBe(ctx2)

    Spy.bind(ctx2)()

    expect(Spy.mock.contexts).toHaveLength(2)
    expect(Spy.mock.contexts[1]).toBe(ctx2)

    Spy.apply(ctx2)

    expect(Spy.mock.contexts).toHaveLength(3)
    expect(Spy.mock.contexts[2]).toBe(ctx2)
  })

  it('tracks spied class contexts and instances', () => {
    interface SpyClass {}
    interface SpyConstructor {
      (): SpyClass
      new (): SpyClass
    }
    const Spy = (function () {}) as SpyConstructor
    const obj = { Spy }
    const spy = vi.spyOn(obj, 'Spy')
    const instance = new obj.Spy()

    expectTypeOf(spy.mock.contexts[0]).toEqualTypeOf<SpyClass>()
    expect(spy.mock.instances).toEqual([instance])
    expect(spy.mock.contexts).toEqual([instance])
  })

  it('throws an error when constructing a class with an arrow function', () => {
    function getTypeError() {
      // esbuild transforms it into () => {\n}, but rolldown keeps it
      return new TypeError(rolldownVersion
        ? '() => {} is not a constructor'
        : `() => {
    } is not a constructor`)
    }

    const arrow = () => {}
    const Fn = vi.fn(arrow)
    expect(() => new Fn()).toThrow(new TypeError(
      `The spy implementation did not use 'function' or 'class', see https://vitest.dev/api/vi#vi-spyon for examples.`,
      {
        cause: getTypeError(),
      },
    ))

    const obj = {
      Spy: arrow,
    }

    vi.spyOn(obj, 'Spy')

    expect(
      // @ts-expect-error typescript knows you can't do that
      () => new obj.Spy(),
    ).toThrow(new TypeError(
      `The spy implementation did not use 'function' or 'class', see https://vitest.dev/api/vi#vi-spyon for examples.`,
      {
        cause: getTypeError(),
      },
    ))

    const properClass = {
      Spy: class {},
    }

    vi.spyOn(properClass, 'Spy').mockImplementation(() => {})

    expect(() => new properClass.Spy()).toThrow(new TypeError(
      `The spy implementation did not use 'function' or 'class', see https://vitest.dev/api/vi#vi-spyon for examples.`,
      {
        cause: getTypeError(),
      },
    ))
  })

  it('implementation is set correctly on init', () => {
    const impl = () => 1
    const mock1 = vi.fn(impl)

    expect(mock1.getMockImplementation()).toEqual(impl)

    const mock2 = vi.fn()

    expect(mock2.getMockImplementation()).toBeUndefined()
  })

  it('implementation types allow only function returned types', () => {
    function fn() {
      return 1
    }

    function asyncFn() {
      return Promise.resolve(1)
    }

    const mock1 = vi.fn(fn)
    const mock2 = vi.fn(asyncFn)

    mock1.mockImplementation(() => 2)
    // @ts-expect-error promise is not allowed
    mock1.mockImplementation(() => Promise.resolve(2))

    // @ts-expect-error non-promise is not allowed
    mock2.mockImplementation(() => 2)
    mock2.mockImplementation(() => Promise.resolve(2))
  })

  it('implementation sync fn', () => {
    const originalFn = function () {
      return 'original'
    }
    const spy = vi.fn(originalFn)

    spy() // returns 'original'

    expect(spy.getMockImplementation()).toBe(originalFn)

    spy.mockReturnValueOnce('2-once').mockReturnValueOnce('3-once')

    spy() // returns '2-once'
    spy() // returns '3-once'
    spy() // returns 'original'

    const implOnce = () => 'once'

    spy.mockImplementationOnce(implOnce)

    spy() // returns 'once'
    spy() // returns 'original'

    expect(spy.getMockImplementation() === implOnce).toBe(false) // jest doesn't store Once implementations

    const impl = () => 'unlimited'

    spy.mockImplementation(impl)

    spy() // returns 'unlimited'
    spy()
    spy()

    expect(spy.getMockImplementation() === impl).toBe(true)

    spy.mockReturnValue('return-unlimited')

    spy()
    spy()

    expect(spy.mock.results).toEqual([
      r('original'),
      r('2-once'),
      r('3-once'),
      r('original'),
      r('once'),
      r('original'),
      r('unlimited'),
      r('unlimited'),
      r('unlimited'),
      r('return-unlimited'),
      r('return-unlimited'),
    ])

    spy.mockRestore()

    expect(spy.getMockImplementation()).toBe(undefined)

    expect(spy.mock.results).toEqual([])
  })

  it('implementation async fn', async () => {
    const originalFn = async function () {
      return 'original'
    }
    const spy = vi.fn(originalFn)

    await spy() // returns 'original'

    spy
      .mockResolvedValue('unlimited')
      .mockResolvedValueOnce('3-once')
      .mockResolvedValueOnce('4-once')

    await spy()
    await spy()
    await spy()
    await spy()

    expect(spy.mock.settledResults).toEqual([
      f('original'),
      f('3-once'),
      f('4-once'),
      f('unlimited'),
      f('unlimited'),
    ])
  })

  it('invocationOrder', () => {
    const a = vi.fn()
    const b = vi.fn()

    a()
    b()

    expect(a.mock.invocationCallOrder[0]).toBeLessThan(b.mock.invocationCallOrder[0])
  })

  it('should spy on property getter, and mockRestore should restore original descriptor', () => {
    const obj = {
      get getter() {
        return 'original'
      },
    }

    const spy = vi.spyOn(obj, 'getter', 'get')

    expect(obj.getter).toBe('original')

    spy.mockImplementation(() => 'mocked').mockImplementationOnce(() => 'once')

    expect(obj.getter).toBe('once')
    expect(obj.getter).toBe('mocked')
    expect(obj.getter).toBe('mocked')

    spy.mockReturnValue('returned').mockReturnValueOnce('returned-once')

    expect(obj.getter).toBe('returned-once')
    expect(obj.getter).toBe('returned')
    expect(obj.getter).toBe('returned')

    spy.mockRestore()

    expect(obj.getter).toBe('original')
    expect(spy).not.toHaveBeenCalled()
  })

  it('should spy on property getter, and mockReset should not restore original descriptor', () => {
    const obj = {
      get getter() {
        return 'original'
      },
    }

    const spy = vi.spyOn(obj, 'getter', 'get')

    expect(obj.getter).toBe('original')

    spy.mockImplementation(() => 'mocked').mockImplementationOnce(() => 'once')

    expect(obj.getter).toBe('once')
    expect(obj.getter).toBe('mocked')
    expect(obj.getter).toBe('mocked')

    spy.mockReturnValue('returned').mockReturnValueOnce('returned-once')

    expect(obj.getter).toBe('returned-once')
    expect(obj.getter).toBe('returned')
    expect(obj.getter).toBe('returned')

    spy.mockReset()

    expect(obj.getter).toBe('original')
    expect(spy).toHaveBeenCalled()
  })

  it('should spy on function returned from property getter', () => {
    const obj = {
      get getter() {
        return function () {
          return 'original'
        }
      },
    }

    const spy = vi.spyOn(obj, 'getter')

    expect(obj.getter()).toBe('original')

    spy.mockImplementation(() => 'mocked').mockImplementationOnce(() => 'once')

    expect(obj.getter()).toBe('once')
    expect(obj.getter()).toBe('mocked')
    expect(obj.getter()).toBe('mocked')
  })

  it('should spy on property setter (1)', () => {
    let setValue = 'original'
    let mockedValue = 'none'

    const obj = {
      get setter() {
        return setValue
      },
      set setter(v: any) {
        setValue = v
      },
    }

    const spy = vi.spyOn(obj, 'setter', 'set')

    obj.setter = 'first'

    expect(setValue).toBe('first')
    expect(mockedValue).toBe('none')

    spy.mockImplementation(() => (mockedValue = 'mocked')).mockImplementationOnce(() => (mockedValue = 'once'))

    obj.setter = 'i can do whatever'
    expect(mockedValue).toBe('once')
    expect(setValue).toBe('first')

    obj.setter = 'does nothing'
    expect(mockedValue).toBe('mocked')
    expect(setValue).toBe('first')

    obj.setter = 'since setter is mocked'
    expect(mockedValue).toBe('mocked')
    expect(setValue).toBe('first')

    spy.mockRestore()

    obj.setter = 'last'

    expect(spy.getMockImplementation()).toBe(undefined)

    expect(setValue).toBe('last')
  })

  it('should spy on property setter (2), and mockRestore should restore original descriptor', () => {
    const obj = {
      _property: false,
      set property(value) {
        this._property = value
      },
      get property() {
        return this._property
      },
    }

    const spy = vi.spyOn(obj, 'property', 'set')
    obj.property = true
    expect(spy).toHaveBeenCalled()
    expect(obj.property).toBe(true)
    obj.property = false
    spy.mockRestore()
    obj.property = true
    // like jest, mockRestore restores the original descriptor,
    // we are not spying on the setter any more
    expect(spy).not.toHaveBeenCalled()
    expect(obj.property).toBe(true)
  })

  it('respyin on a spy resets the counter', () => {
    const obj = {
      method() {
        return 'original'
      },
    }
    vi.spyOn(obj, 'method')
    obj.method()
    expect(obj.method).toHaveBeenCalledTimes(1)
    vi.spyOn(obj, 'method')
    obj.method()
    expect(obj.method).toHaveBeenCalledTimes(1)
  })

  it('spyOn on the getter multiple times', () => {
    const obj = {
      get getter() {
        return 'original'
      },
    }

    vi.spyOn(obj, 'getter', 'get').mockImplementation(() => 'mocked')
    vi.spyOn(obj, 'getter', 'get')

    expect(obj.getter).toBe('mocked')
  })

  it('spyOn multiple times', () => {
    const obj = {
      method() {
        return 'original'
      },
    }

    const spy1 = vi.spyOn(obj, 'method').mockImplementation(() => 'mocked')
    const spy2 = vi.spyOn(obj, 'method')

    expect(vi.isMockFunction(obj.method)).toBe(true)
    expect(obj.method()).toBe('mocked')
    expect(spy1).not.toBe(spy2)

    spy2.mockImplementation(() => 'mocked2')

    expect(obj.method()).toBe('mocked2')

    spy2.mockRestore()

    expect(obj.method()).toBe('original')
    expect(vi.isMockFunction(obj.method)).toBe(false)
    expect(obj.method).not.toBe(spy1)

    spy1.mockRestore()
    expect(vi.isMockFunction(obj.method)).toBe(false)
    expect(obj.method).not.toBe(spy1)
  })

  it('restoreAllMocks in stack order', () => {
    const obj = { foo: () => 'foo' }

    vi.spyOn(obj, 'foo').mockImplementation(() => 'mocked1')
    expect(obj.foo()).toBe('mocked1')
    expect(vi.isMockFunction(obj.foo)).toBe(true)

    vi.spyOn(obj, 'foo').mockImplementation(() => 'mocked2')
    expect(obj.foo()).toBe('mocked2')
    expect(vi.isMockFunction(obj.foo)).toBe(true)

    vi.restoreAllMocks()

    expect(obj.foo()).toBe('foo')
    expect(vi.isMockFunction(obj.foo)).toBe(false)
  })

  it('should spy on property setter (2), and mockReset should not restore original descriptor', () => {
    const obj = {
      _property: false,
      set property(value) {
        this._property = value
      },
      get property() {
        return this._property
      },
    }

    const spy = vi.spyOn(obj, 'property', 'set')
    obj.property = true
    expect(spy).toHaveBeenCalled()
    expect(obj.property).toBe(true)
    obj.property = false
    spy.mockReset()
    obj.property = true
    // unlike jest, vitest's mockReset will restore original implementation without restoring the original descriptor.
    // We are still spying on the setter
    expect(spy).toHaveBeenCalled()
    expect(obj.property).toBe(true)
  })

  it('throwing', async () => {
    const fn = vi.fn(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'error'
    })

    try {
      fn()
    }
    catch {}

    expect(fn.mock.results).toEqual([
      e('error'),
    ])
  })

  it('mockRejectedValue', async () => {
    const safeCall = async (fn: () => void) => {
      try {
        await fn()
      }
      catch {}
    }

    const spy = vi.fn()
      .mockRejectedValue(new Error('error'))
      .mockRejectedValueOnce(new Error('once'))

    await safeCall(spy)
    await safeCall(spy)

    expect(spy.mock.results[0]).toEqual({
      type: 'return',
      value: expect.any(Promise),
    })
    expect(spy.mock.settledResults[0]).toEqual(h(new Error('once')))
    expect(spy.mock.settledResults[1]).toEqual(h(new Error('error')))
  })
  it('mockResolvedValue', async () => {
    const spy = vi.fn()
      .mockResolvedValue('resolved')
      .mockResolvedValueOnce('once')

    await spy()
    await spy()

    expect(spy.mock.results[0]).toEqual({
      type: 'return',
      value: expect.any(Promise),
    })
    expect(spy.mock.settledResults[0]).toEqual(f('once'))
    expect(spy.mock.settledResults[1]).toEqual(f('resolved'))
  })

  it('tracks instances made by mocks', () => {
    const Fn = vi.fn()
    expect(Fn.mock.instances).toEqual([])

    const instance1 = new Fn()
    expect(Fn.mock.instances[0]).toBe(instance1)

    const instance2 = new Fn()
    expect(Fn.mock.instances[1]).toBe(instance2)
  })

  it('.mockRestore() should restore initial implementation', () => {
    const testFn = vi.fn(() => true)
    expect(testFn()).toBe(true)

    testFn.mockReturnValue(false)
    expect(testFn()).toBe(false)

    testFn.mockRestore()
    expect(testFn()).toBe(true)
  })

  abstract class Dog_ {
    public name: string

    constructor(name: string) {
      this.name = name
    }

    abstract speak(): string
    abstract feed(): void
  }

  it('mocks constructors', () => {
    const Dog = vi.fn<(name: string) => Dog_>(function Dog_(name: string) {
      this.name = name
    } as (this: any, name: string) => Dog_)

    ;(Dog as any).getType = vi.fn(() => 'mocked animal')

    Dog.prototype.speak = vi.fn(() => 'loud bark!')
    Dog.prototype.feed = vi.fn()

    const dogMax = new Dog('Max')
    expect(dogMax.name).toBe('Max')

    expect(dogMax.speak()).toBe('loud bark!')
    expect(dogMax.speak).toHaveBeenCalled()

    vi.mocked(dogMax.speak).mockReturnValue('woof woof')
    expect(dogMax.speak()).toBe('woof woof')
  })

  it('mock classes', () => {
    const Dog = vi.fn(class Dog {
      constructor(public name: string) {
        this.name = name
      }

      static getType: () => string = vi.fn(() => 'mocked animal')
      speak = vi.fn(() => 'loud bark!')
      feed = vi.fn()
    })

    const dogMax = new Dog('Max')
    expect(dogMax.name).toBe('Max')

    expect(dogMax.speak()).toBe('loud bark!')
    expect(dogMax.speak).toHaveBeenCalled()

    vi.mocked(dogMax.speak).mockReturnValue('woof woof')
    expect(dogMax.speak()).toBe('woof woof')
  })

  it('spies on classes', () => {
    class Example {
      test() {}
    }

    const obj = {
      Example,
    }

    const Spy = vi.spyOn(obj, 'Example')

    Spy.mockImplementation(() => {})

    expect(() => new Spy()).toThrowError(TypeError)

    Spy.mockImplementation(function () {
      expectTypeOf(this.test).toEqualTypeOf<() => void>()
      this.test = () => {}
    })

    expect(new Spy()).toBeInstanceOf(Spy)

    class MockExample {
      test() {}
    }
    Spy.mockImplementation(MockExample)

    expect(new Spy()).toBeInstanceOf(Spy)
    expect(new Spy()).not.toBeInstanceOf(MockExample)

    const instance = new Spy()
    expectTypeOf(instance).toEqualTypeOf<Example>()
  })

  it('returns temporary implementations from getMockImplementation()', () => {
    const fn = vi.fn()

    const temporaryMockImplementation = () => 'mocked value'
    fn.mockImplementationOnce(temporaryMockImplementation)
    expect(fn.getMockImplementation()).toBe(temporaryMockImplementation)

    // After calling it, it should be back to undefined
    fn()
    expect(fn.getMockImplementation()).toBe(undefined)

    const mockImplementation = () => 'other mocked value'
    fn.mockImplementation(mockImplementation)
    expect(fn.getMockImplementation()).toBe(mockImplementation)

    // It should also overwrite permanent implementations
    fn.mockImplementationOnce(temporaryMockImplementation)
    expect(fn.getMockImplementation()).toBe(temporaryMockImplementation)
  })

  it('keeps the descriptor the same as the original one when restoring', () => {
    class Foo {
      f() {
        return 'original'
      }
    }

    // initially there's no own properties
    const foo = new Foo()
    expect(foo.f()).toMatchInlineSnapshot(`"original"`)
    expect(Object.getOwnPropertyDescriptors(foo)).toMatchInlineSnapshot(`{}`)

    // mocked function in own property
    const spy = vi.spyOn(foo, 'f').mockImplementation(() => 'mocked')
    expect(foo.f()).toMatchInlineSnapshot(`"mocked"`)
    expect(Object.getOwnPropertyDescriptors(foo)).toMatchInlineSnapshot(`
    {
      "f": {
        "configurable": true,
        "enumerable": false,
        "value": [MockFunction f] {
          "calls": [
            [],
          ],
          "results": [
            {
              "type": "return",
              "value": "mocked",
            },
          ],
        },
        "writable": true,
      },
    }
  `)

    // probably original prototype method is not moved to own property
    spy.mockRestore()
    expect(foo.f()).toMatchInlineSnapshot(`"original"`)
    expect(Object.getOwnPropertyDescriptors(foo)).toMatchInlineSnapshot(`{}`)
  })

  it('mocks inherited methods', () => {
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
    }).not.toThrowError()
    expect(foo.bar).toEqual('foo')
  })

  it('mocks inherited overridden methods', () => {
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
      // @ts-expect-error bar is readonly
      foo.bar = 'baz'
    }).toThrowError()
    expect(foo.bar).toEqual('foo')
  })

  describe('is disposable', () => {
    describe.runIf(Symbol.dispose)('in environments supporting it', () => {
      it('has dispose property', () => {
        expect(vi.fn()[Symbol.dispose]).toBeTypeOf('function')
      })

      it('calls mockRestore when disposing', () => {
        const fn = vi.fn()
        const restoreSpy = vi.spyOn(fn, 'mockRestore')
        {
          using _fn2 = fn
        }
        expect(restoreSpy).toHaveBeenCalled()
      })

      it('allows disposal when using mockImplementation', () => {
        expect(vi.fn().mockImplementation(() => {})[Symbol.dispose]).toBeTypeOf('function')
      })
    })

    describe.skipIf(Symbol.dispose)('in environments not supporting it', () => {
      it('does not have dispose property', () => {
        expect(vi.fn()[Symbol.dispose]).toBeUndefined()
      })
    })
  })

  describe('docs example', () => {
    it('mockClear', () => {
      const person = {
        greet: (name: string) => `Hello ${name}`,
      }
      const spy = vi.spyOn(person, 'greet').mockImplementation(() => 'mocked')
      expect(person.greet('Alice')).toBe('mocked')
      expect(spy.mock.calls).toEqual([['Alice']])

      // clear call history but keep mock implementation
      spy.mockClear()
      expect(spy.mock.calls).toEqual([])
      expect(person.greet('Bob')).toBe('mocked')
      expect(spy.mock.calls).toEqual([['Bob']])
    })

    it('mockReset', () => {
      const person = {
        greet: (name: string) => `Hello ${name}`,
      }
      const spy = vi.spyOn(person, 'greet').mockImplementation(() => 'mocked')
      expect(person.greet('Alice')).toBe('mocked')
      expect(spy.mock.calls).toEqual([['Alice']])

      // clear call history and reset implementation, but method is still spied
      spy.mockReset()
      expect(spy.mock.calls).toEqual([])
      expect(person.greet).toBe(spy)
      expect(person.greet('Bob')).toBe('Hello Bob')
      expect(spy.mock.calls).toEqual([['Bob']])
    })

    it('mockRestore', () => {
      const person = {
        greet: (name: string) => `Hello ${name}`,
      }
      const spy = vi.spyOn(person, 'greet').mockImplementation(() => 'mocked')
      expect(person.greet('Alice')).toBe('mocked')
      expect(spy.mock.calls).toEqual([['Alice']])

      // clear call history and restore spied object method
      spy.mockRestore()
      expect(spy.mock.calls).toEqual([])
      expect(person.greet).not.toBe(spy)
      expect(person.greet('Bob')).toBe('Hello Bob')
      expect(spy.mock.calls).toEqual([])
    })
  })
})
