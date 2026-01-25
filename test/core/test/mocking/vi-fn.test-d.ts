import type { Mock, MockResult, MockSettledResult } from 'vitest'
import { expectTypeOf, test, vi } from 'vitest'

type Procedure = (...args: any[]) => any

test('spy.mock when implementation is a class', () => {
  class Klass {
    constructor(_a: string, _b?: number) {
      // ...
    }

    static getType() {
      return 'Klass'
    }
  }

  const Mock = vi.fn(Klass)

  expectTypeOf(Mock.mock.calls).toEqualTypeOf<[a: string, b?: number][]>()
  expectTypeOf(Mock.mock.results).toEqualTypeOf<MockResult<Klass>[]>()
  expectTypeOf(Mock.mock.contexts).toEqualTypeOf<Klass[]>()
  expectTypeOf(Mock.mock.instances).toEqualTypeOf<Klass[]>()
  expectTypeOf(Mock.mock.invocationCallOrder).toEqualTypeOf<number[]>()
  expectTypeOf(Mock.mock.settledResults).toEqualTypeOf<MockSettledResult<Klass>[]>()
  expectTypeOf(Mock.mock.lastCall).toEqualTypeOf<[a: string, b?: number] | undefined>()

  // static properties are defined
  expectTypeOf(Mock.getType).toBeFunction()
  expectTypeOf(Mock.getType).returns.toBeString()

  expectTypeOf(Mock).constructorParameters.toEqualTypeOf<[a: string, b?: number]>()
  expectTypeOf(Mock).instance.toEqualTypeOf<Klass>()
})

test('spy.mock when implementation is a class-like function', () => {
  function Klass(this: typeof Klass, _a: string, _b?: number) {
    // ...
  }

  const Mock = vi.fn(Klass)

  expectTypeOf(Mock.mock.calls).toEqualTypeOf<[a: string, b?: number][]>()
  expectTypeOf(Mock.mock.results).toEqualTypeOf<MockResult<void>[]>()
  expectTypeOf(Mock.mock.contexts).toEqualTypeOf<typeof Klass[]>()
  expectTypeOf(Mock.mock.instances).toEqualTypeOf<typeof Klass[]>()
  expectTypeOf(Mock.mock.invocationCallOrder).toEqualTypeOf<number[]>()
  expectTypeOf(Mock.mock.settledResults).toEqualTypeOf<MockSettledResult<void>[]>()
  expectTypeOf(Mock.mock.lastCall).toEqualTypeOf<[a: string, b?: number] | undefined>()

  expectTypeOf(Mock).constructorParameters.toEqualTypeOf<[a: string, b?: number]>()
})

test('spy.mock when implementation is a normal function', () => {
  function FN(_a: string, _b?: number) {
    return 42
  }

  const Mock = vi.fn(FN)

  expectTypeOf(Mock.mock.calls).toEqualTypeOf<[a: string, b?: number][]>()
  expectTypeOf(Mock.mock.results).toEqualTypeOf<MockResult<number>[]>()
  expectTypeOf(Mock.mock.contexts).toEqualTypeOf<unknown[]>()
  expectTypeOf(Mock.mock.instances).toEqualTypeOf<unknown[]>()
  expectTypeOf(Mock.mock.invocationCallOrder).toEqualTypeOf<number[]>()
  expectTypeOf(Mock.mock.settledResults).toEqualTypeOf<MockSettledResult<number>[]>()
  expectTypeOf(Mock.mock.lastCall).toEqualTypeOf<[a: string, b?: number] | undefined>()

  expectTypeOf(Mock).constructorParameters.toEqualTypeOf<[a: string, b?: number]>()
})

test('cann call a function mock with and without new', () => {
  const Mock = vi.fn(function fn(this: any) {
    this.test = true
  })

  const _mockClass = new Mock()
  const _mockFn = Mock()
})

test('cannot call class mock without new', () => {
  const Mock = vi.fn(class {})

  const _mockClass = new Mock()
  // @ts-expect-error value is not callable
  const _mockFn = Mock()
})

test('spying on a function that supports new', () => {
  interface ReturnClass {}
  interface BothFnAndClass {
    new (): ReturnClass
    (): ReturnClass
  }

  const Mock = vi.fn(function R() {} as BothFnAndClass)

  // supports new
  const _mockClass = new Mock()
  // supports T()
  const _mockFn = Mock()
})

test('withImplementation returns correct type', () => {
  const spy = vi.fn()

  const result42 = spy.withImplementation(() => {}, () => {
    return 42
  })
  expectTypeOf(result42).toEqualTypeOf<Mock<Procedure>>()

  const resultObject = spy.withImplementation(() => {}, () => {
    return { then: () => 42 }
  })
  expectTypeOf(resultObject).toEqualTypeOf<Mock<Procedure>>()

  const resultVoid = spy.withImplementation(() => {}, () => {})
  expectTypeOf(resultVoid).toEqualTypeOf<Mock<Procedure>>()

  const promise42 = spy.withImplementation(() => {}, async () => {
    return 42
  })
  expectTypeOf(promise42).toEqualTypeOf<Promise<Mock<Procedure>>>()

  const promiseObject = spy.withImplementation(() => {}, async () => {
    return { hello: () => 42 }
  })
  expectTypeOf(promiseObject).toEqualTypeOf<Promise<Mock<Procedure>>>()

  const promiseVoid = spy.withImplementation(() => {}, async () => {})
  expectTypeOf(promiseVoid).toEqualTypeOf<Promise<Mock<Procedure>>>()

  const promisePromise = spy.withImplementation(() => {}, () => {
    return Promise.resolve()
  })
  expectTypeOf(promisePromise).toEqualTypeOf<Promise<Mock<Procedure>>>()
})
