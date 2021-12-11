import { util } from 'chai'
import sinon, { SinonStub } from 'sinon'

interface MockResultReturn<T> {
  type: 'return'
  value: T
}
interface MockResultIncomplete {
  type: 'incomplete'
  value: undefined
}
interface MockResultThrow {
  type: 'throw'
  value: any
}

type MockResult<T> = MockResultReturn<T> | MockResultThrow | MockResultIncomplete

export interface JestMockCompatContext<T, Y> {
  calls: Y[]
  instances: T[]
  // TODO doesnt work
  invocationCallOrder: number[]
  results: Array<MockResult<T>>
}

export interface JestMockCompat<TArgs extends any[] = any[], TReturns = any> extends SinonStub<TArgs, TReturns> {
  getMockName(): string
  mockName(n: string): this
  mock: JestMockCompatContext<TArgs, TReturns>
  mockClear(): this
  mockReset(): this
  mockRestore(): void
  getMockImplementation(): (...args: TArgs) => TReturns
  mockImplementation(fn: (...args: TArgs) => TReturns): this
  mockImplementationOnce(fn: (...args: TArgs) => TReturns): this
  mockReturnThis(): this
  mockReturnValue(obj: any): this
  mockReturnValueOnce(obj: any): this
  mockResolvedValue(obj: any): this
  mockResolvedValueOnce(obj: any): this
  mockRejectedValueValue(obj: any): this
  mockRejectedValueOnce(obj: any): this
}

export interface JestMockCompatStatic {
  /**
   * Creates an anonymous stub function
   */
  <TArgs extends any[] = any[], R = any>(): JestMockCompat<TArgs, R>

  /**
   * Creates a stub function with implementation
   */
  <TArgs extends any[] = any[], R = any>(impl: (...args: TArgs) => R): JestMockCompat<TArgs, R>

  /**
   * Replaces obj.method with a stub function.
   * An exception is thrown if the property is not already a function.
   * The original function can be restored by calling object.method.restore(); (or stub.restore();).
   */
  <T, K extends keyof T>(obj: T, method: K, accessType?: 'get' | 'set'): T[K] extends (...args: infer TArgs) => infer TReturnValue
    ? JestMockCompat<TArgs, TReturnValue>
    : JestMockCompat
}

// TODO overload with accessType
export const spyOn: JestMockCompatStatic = <TArgs extends any[], TReturns>(fnOrObj, method?: string, accessType?: 'get' | 'set'): JestMockCompat<TArgs, TReturns> => {
  // @ts-expect-error
  const stub = typeof fnOrObj === 'function' ? sinon.stub({ fn: fnOrObj }, 'fn') : sinon.stub(fnOrObj, method) as SinonStub

  // can use sinon.addBehavior, but we can't set mock or make a custom implementation
  // also we are storing implementation
  const addMethod = (n: string, fn: (...args: any[]) => any) => {
    Object.defineProperty(stub, n, {
      value: fn,
      writable: false,
      enumerable: true,
    })
  }

  let implementation: ((...args: TArgs) => any) | undefined

  const mockContext = {
    get calls() {
      return stub.args
    },
    get instances() {
      return stub.thisValues
    },
    // TODO it is global between tests
    // and I don't really know what it returns, never worked with it
    get invocationCallOrder() {
      return []
    },
    get results() {
      return stub.getCalls().map((call) => {
        const type = call.threw() ? 'throw' : 'return'
        const value = call.returnValue
        return { type, value }
      })
    },
  }

  let mockMethodCalled = 0

  const getOnceCall = () => stub.callCount - 1 + mockMethodCalled

  const assertAccessType = (type: 'get' | 'set') => {
    if (accessType && type !== accessType)
      throw new TypeError(`invalid access type, ${type} expected, ${accessType} recieved`)
  }

  const asseetNoAccessType = () => {
    if (accessType)
      throw new TypeError(`no accessType for this method allowed, recieved ${accessType}`)
  }

  addMethod('getMockName', () => stub.name)
  addMethod('mockName', (n: string) => {
    stub.named(n)
    return stub
  })
  addMethod('mockClear', () => {
    stub.resetHistory()
    return stub
  })
  addMethod('mockReset', () => {
    stub.resetHistory()
    return stub
  })
  addMethod('mockRestore', () => {
    implementation = undefined
    stub.restore()
    stub[accessType || 'callsFake'](stub.wrappedMethod)
  })
  addMethod('getMockImplementation', () => implementation)
  addMethod('mockImplementation', (fn: (...args: TArgs) => TReturns) => {
    implementation = fn

    stub[accessType || 'callsFake'](fn)

    return stub
  })
  addMethod('mockImplementationOnce', (fn: (...args: TArgs) => TReturns) => {
    mockMethodCalled++
    let callCount = 0
    stub[accessType || 'callsFake'](function(this: any, ...args: TArgs) {
      callCount++
      return callCount === 1
        ? fn.call(this, ...args)
        : (implementation || stub.wrappedMethod).call(this, ...args)
    })
    return stub
  })
  addMethod('mockReturnThis', () => {
    throw new Error('not implemented')
    // const fn = function(this: any) {
    //   return this
    // }
    // implementation = fn
    // stub.callsFake(fn)
    // return stub
  })
  addMethod('mockReturnValue', (obj: any) => {
    assertAccessType('get')
    const fn = () => obj
    implementation = fn
    stub[accessType || 'callsFake'](fn)
    return stub
  })
  addMethod('mockReturnValueOnce', (obj: any) => {
    assertAccessType('get')
    mockMethodCalled++
    const fn = () => obj
    stub.onCall(getOnceCall())[accessType || 'callsFake'](fn)
    return stub
  })
  addMethod('mockResolvedValue', (obj: any) => {
    asseetNoAccessType()
    implementation = async() => obj
    stub.resolves(obj)
    return stub
  })
  addMethod('mockResolvedValueOnce', (obj: any) => {
    asseetNoAccessType()
    mockMethodCalled++
    stub.onCall(getOnceCall()).resolves(obj)
    return stub
  })
  addMethod('mockRejectedValue', (obj: any) => {
    asseetNoAccessType()
    implementation = async() => {
      throw obj
    }
    stub.rejects(obj)
    return stub
  })
  addMethod('mockRejectedValueOnce', (obj: any) => {
    asseetNoAccessType()
    mockMethodCalled++
    stub.onCall(getOnceCall()).rejects(obj)
    return stub
  })

  util.addProperty(stub, 'mock', () => mockContext)

  stub.callsFake(stub.wrappedMethod)

  return stub as any
}

export const fn = spyOn

// TODO make them globally available on some object, like jest.spyOn

// @ts-expect-error
sinon.fn = spyOn
// @ts-expect-error
sinon.spyOn = spyOn
