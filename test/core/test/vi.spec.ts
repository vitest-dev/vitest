/**
 * @vitest-environment jsdom
 */

import type { Mock, Mocked, MockedFunction, MockedObject, MockInstance } from 'vitest'
import { describe, expect, expectTypeOf, test, vi } from 'vitest'
import { getWorkerState } from '../../../packages/vitest/src/runtime/utils'

function expectType<T>(obj: T) {
  return obj
}

describe('testing vi utils', () => {
  test('global scope has variable', () => {
    const IntersectionObserverMock = vi.fn()
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    expect(globalThis.IntersectionObserver).toBe(IntersectionObserverMock)
    expect(window.IntersectionObserver).toBe(IntersectionObserverMock)
    expect(IntersectionObserver).toBe(IntersectionObserverMock)
  })

  test('resetting modules', async () => {
    const mod1 = await import('../src/env')
    vi.resetModules()
    const mod2 = await import('../src/env')
    const mod3 = await import('../src/env')
    expect(mod1).not.toBe(mod2)
    expect(mod2).toBe(mod3)
  })

  test('resetting modules doesn\'t reset vitest', async () => {
    const v1 = await import('vitest')
    vi.resetModules()
    const v2 = await import('vitest')
    expect(v1).toBe(v2)
  })

  test('vi mocked', () => {
    expectType<MockedObject<{ bar: () => boolean }>>({
      bar: vi.fn(() => true),
    })
    expectType<MockedFunction<() => boolean>>(vi.fn(() => true))
    expectType<MockedFunction<() => boolean>>(vi.fn())

    expectType<MockedFunction<() => boolean>>(vi.fn<() => boolean>(() => true))
    expectType<Mock<() => boolean>>(vi.fn<() => boolean>(() => true))
    expectType<() => boolean>(vi.fn(() => true))

    expectType<(v: number) => boolean>(vi.fn())
  })

  test('vi partial mocked', () => {
    interface FooBar {
      foo: () => void
      bar: () => boolean
      baz: string
    }

    const mockFnFactory = vi.fn<() => FooBar>()

    vi.mocked(mockFnFactory, { partial: true }).mockReturnValue({
      foo: vi.fn(),
    })

    vi.mocked(mockFnFactory, { partial: true, deep: false }).mockReturnValue({
      bar: vi.fn<FooBar['bar']>(),
    })

    vi.mocked(mockFnFactory, { partial: true, deep: true }).mockReturnValue({
      baz: 'baz',
    })

    if (0) {
      const mockFactory = (): FooBar => ({} as FooBar)

      vi.mocked(mockFactory, { partial: true }).mockReturnValue({
        foo: vi.fn(),
      })

      vi.mocked(mockFactory, { partial: true, deep: false }).mockReturnValue({
        bar: vi.fn<FooBar['bar']>(),
      })

      vi.mocked(mockFactory, { partial: true, deep: true }).mockReturnValue({
        baz: 'baz',
      })

      const mockFactoryAsync = async (): Promise<FooBar> => ({} as FooBar)

      vi.mocked(mockFactoryAsync, { partial: true }).mockResolvedValue({
        foo: vi.fn(),
      })

      vi.mocked(mockFactoryAsync, { partial: true, deep: false }).mockResolvedValue({
        bar: vi.fn<FooBar['bar']>(),
      })

      vi.mocked(mockFactoryAsync, { partial: true, deep: true }).mockResolvedValue({
        baz: 'baz',
      })
    }

    function fetchSomething(): Promise<Response> {
      return fetch('https://vitest.dev/')
    };
    if (0) {
      // type check only
      vi.mocked(fetchSomething).mockResolvedValue(new Response(null))
      vi.mocked(fetchSomething, { partial: true }).mockResolvedValue({ ok: false })
    }

    // #8152
    if (0) {
      interface NestedObject {
        level1: {
          level2: {
            value: string
            count: number
          }
          name: string
        }
        items: string[]
      }

      const mockNestedFactory = vi.fn<() => NestedObject>()

      vi.mocked(mockNestedFactory, { partial: true, deep: true }).mockReturnValue({
        level1: { level2: {} },
      })
      vi.mocked(mockNestedFactory, { partial: true, deep: true }).mockReturnValue({
        level1: {},
      })
      vi.mocked(mockNestedFactory, { partial: true, deep: true }).mockReturnValue({})
      vi.mocked(mockNestedFactory, { partial: true, deep: true }).mockReturnValue({
        items: ['a', 'b'],
      })

      const mockNestedAsyncFactory = vi.fn<() => Promise<NestedObject>>()

      vi.mocked(mockNestedAsyncFactory, { partial: true, deep: true }).mockResolvedValue({
        level1: { level2: {} },
      })
      vi.mocked(mockNestedAsyncFactory, { partial: true, deep: true }).mockResolvedValue({})
    }
  })

  test('vi.mocked with classes', () => {
    class Foo {
      constructor(public readonly bar: string) {}

      public getBar(): string {
        return this.bar
      }
    }
    class FooMock implements Mocked<Foo> {
      readonly barMock: Mock<() => string> = vi.fn()

      public get bar(): string {
        return this.barMock()
      }

      public getBar: Mock<() => string> = vi
        .fn()
        .mockImplementation(() => this.barMock())
    }

    // type check only
    if (0) {
      vi.mocked(Foo).mockImplementation(FooMock)
      vi.mocked(Foo).mockImplementation(Foo)
    }
  })

  test('vi.fn and Mock type', () => {
    // use case from https://github.com/vitest-dev/vitest/issues/4723#issuecomment-1851034249

    // hypothetical library to be tested
    type SomeFn = (v: string) => number
    function acceptSomeFn(f: SomeFn) {
      f('hi')
    }

    // SETUP
    // no args are allowed even though it's not type safe
    const someFn1: Mock<SomeFn> = vi.fn()

    // argument types are inferred
    const someFn2: Mock<SomeFn> = vi.fn((v) => {
      expectTypeOf(v).toEqualTypeOf<string>()
      return 0
    })

    // arguments are not necessary
    const someFn3: Mock<SomeFn> = vi.fn(() => 0)

    // @ts-expect-error wrong return type will be caught
    const someFn4: Mock<SomeFn> = vi.fn(() => '0')

    // TEST
    acceptSomeFn(someFn1)
    expect(someFn1).toBeCalledWith('hi')
    expect(someFn2).not.toBeCalled()
    expect(someFn3).not.toBeCalled()
    expect(someFn4).not.toBeCalled()
  })

  test(`vi.spyOn for function overload types`, () => {
    class MyElement {
      scrollTo(options?: ScrollToOptions): void
      scrollTo(x: number, y: number): void
      scrollTo() {}
    }

    // verify `spyOn` is assignable to `MockInstance` with overload
    const spy: MockInstance<MyElement['scrollTo']> = vi.spyOn(
      MyElement.prototype,
      'scrollTo',
    )

    // however `Parameters` only picks up the last overload
    // due to typescript limitation
    expectTypeOf(spy.mock.calls).toEqualTypeOf<
      [x: number, y: number][]
    >()
  })

  test(`mock.contexts types`, () => {
    class TestClass {
      f(this: TestClass) {}
      g() {}
    }

    const fSpy = vi.spyOn(TestClass.prototype, 'f')
    const gSpy = vi.spyOn(TestClass.prototype, 'g')

    // contexts inferred only when `this` is explicitly annotated
    expectTypeOf(fSpy.mock.contexts).toEqualTypeOf<TestClass[]>()
    expectTypeOf(gSpy.mock.contexts).toEqualTypeOf<unknown[]>()
  })

  test('mockImplementation types', async () => {
    // overload
    const fs = { readFileSync() {} } as any as typeof import('node:fs')
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => 'str')
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => Buffer.from('buf'))
    vi.fn(fs.readFileSync).mockImplementation(() => 'str')
    vi.fn(fs.readFileSync).mockImplementation(() => Buffer.from('buf'))

    // union
    interface Handler {
      (v: number): number
      other: (v: number) => number
    }
    vi.fn<Handler>().mockImplementation(v => v + 1)
  })

  test('can change config', () => {
    const state = getWorkerState()
    expect(state.config.hookTimeout).toBe(10000)
    expect(state.config.clearMocks).toBe(false)
    vi.setConfig({ hookTimeout: 6000, clearMocks: true })
    expect(state.config.hookTimeout).toBe(6000)
    expect(state.config.clearMocks).toBe(true)
    vi.resetConfig()
    expect(state.config.hookTimeout).toBe(10000)
    expect(state.config.clearMocks).toBe(false)
  })

  test('loads unloaded module', async () => {
    let mod: any
    import('../src/timeout').then(m => mod = m)

    expect(mod).toBeUndefined()

    await vi.dynamicImportSettled()

    expect(mod).toBeDefined()
    expect(mod.timeout).toBe(100)
  })

  test('mockObject', () => {
    const original = {
      simple: () => 'value',
      nested: {
        method: () => 'real',
      },
      prop: 'foo',
    }

    const mocked = vi.mockObject(original)
    expect(mocked.simple()).toBe(undefined)
    expect(mocked.nested.method()).toBe(undefined)
    expect(mocked.prop).toBe('foo')
    mocked.simple.mockReturnValue('mocked')
    mocked.nested.method.mockReturnValue('mocked nested')
    expect(mocked.simple()).toBe('mocked')
    expect(mocked.nested.method()).toBe('mocked nested')

    const spied = vi.mockObject(original, { spy: true })
    expect(spied.simple()).toBe('value')
    expect(spied.simple).toHaveBeenCalled()
    expect(spied.simple.mock.results).toEqual([{ type: 'return', value: 'value' }])
    spied.simple.mockReturnValue('still mocked')
    expect(spied.simple()).toBe('still mocked')

    class OriginalClass {
      constructor() {
        throw new Error('should be mocked!')
      }

      someFn() {
        return 'value'
      }
    }
    const MockedClass = vi.mockObject(OriginalClass)
    const mockedInstance = new MockedClass()
    expect(MockedClass).toHaveBeenCalled()
    vi.mocked(mockedInstance).someFn.mockImplementation(() => 'mocked')
    expect(mockedInstance.someFn()).toBe('mocked')
  })
})
