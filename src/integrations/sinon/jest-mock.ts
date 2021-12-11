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
  mockReturnValue(obj: TReturns): this
  mockReturnValueOnce(obj: TReturns): this
  mockResolvedValue(obj: TReturns extends Promise<infer T> ? T : never): this
  mockResolvedValueOnce(obj: TReturns extends Promise<infer T> ? T : never): this
  mockRejectedValueValue(obj: TReturns extends Promise<any> ? any : never): this
  mockRejectedValueOnce(obj: TReturns extends Promise<any> ? any : never): this
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

export function spyOn<TArgs extends any[] = any[], R = any>(): JestMockCompat<TArgs, R>
export function spyOn<TArgs extends any[] = any[], R = any>(
  implementation: (...args: TArgs) => R
): JestMockCompat<TArgs, R>
export function spyOn<T, K extends keyof T>(
  obj: T,
  method: K,
  accessType?: 'get' | 'set',
): T[K] extends (...args: infer TArgs) => infer TReturnValue
  ? JestMockCompat<TArgs, TReturnValue> : JestMockCompat
export function spyOn<TArgs extends any[], TReturns>(
  fnOrObj?: ((...args: TArgs) => TReturns) | object,
  method?: string,
  accessType?: 'get' | 'set',
): JestMockCompat<TArgs, TReturns> {
  const getDescriptor = () => {
    if (!fnOrObj || typeof fnOrObj === 'function') return null

    return Object.getOwnPropertyDescriptor(fnOrObj, method!)!
  }

  const getOriginalFn = () => {
    if (!fnOrObj || typeof fnOrObj === 'function') return fnOrObj

    return getDescriptor()![accessType || 'value']
  }

  const originalFn = getOriginalFn()
  const descriptor = getDescriptor()

  // @ts-expect-error
  const stub = typeof fnOrObj === 'function' ? sinon.stub({ fn: fnOrObj }, 'fn') : sinon.stub(fnOrObj, method) as SinonStub

  // sinon.addBehavior can be used, but we can't set "mock" or make a custom implementation
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

  // this variable exists for chaining .*Once methods
  // so thay can be called like `.mockImplementation(fn).mockImplementationOnce(fnOnce).mockImplementationOnce(fnOnceSecond)`
  // spy(), spy(), spy() // called fnOnce, then fnOnceSecond and then fn
  let mockMethodCalled = 0

  const getOnceCall = () => stub.callCount + mockMethodCalled
  const willCallFake = (fn: (...args: TArgs) => TReturns) => {
    return stub[accessType || 'callsFake'](fn)
  }

  const assertAccessType = (type: 'get' | 'set') => {
    if (accessType && type !== accessType)
      throw new TypeError(`invalid access type, '${type}' expected, '${accessType}' recieved`)
  }

  const assertNoAccessType = () => {
    if (accessType)
      throw new TypeError(`no accessType for this method allowed, recieved '${accessType}'`)
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
    mockMethodCalled = 0
    stub.resetHistory()
    stub.restore()
    stub.resetBehavior()
  })
  addMethod('getMockImplementation', () => implementation)
  addMethod('mockImplementation', (fn: (...args: TArgs) => TReturns) => {
    implementation = fn
    willCallFake(fn)
    return stub
  })
  addMethod('mockImplementationOnce', (fn: (...args: TArgs) => TReturns) => {
    let callCount = 0
    willCallFake(function(this: any, ...args: TArgs) {
      callCount++
      return callCount === 1
        ? fn.call(this, ...args)
        : (implementation || originalFn).call(this, ...args)
    })
    mockMethodCalled++
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
    willCallFake(fn)
    return stub
  })
  addMethod('mockReturnValueOnce', (obj: any) => {
    assertAccessType('get')
    const fn = () => obj
    stub.onCall(getOnceCall())[accessType || 'callsFake'](fn)
    mockMethodCalled++
    return stub
  })
  addMethod('mockResolvedValue', (obj: any) => {
    assertNoAccessType()
    implementation = async() => obj
    stub.resolves(obj)
    return stub
  })
  addMethod('mockResolvedValueOnce', (obj: any) => {
    assertNoAccessType()
    stub.onCall(getOnceCall()).resolves(obj)
    mockMethodCalled++
    return stub
  })
  addMethod('mockRejectedValue', (obj: any) => {
    assertNoAccessType()
    implementation = async() => {
      throw obj
    }
    stub.rejects(obj)
    return stub
  })
  addMethod('mockRejectedValueOnce', (obj: any) => {
    assertNoAccessType()
    stub.onCall(getOnceCall()).rejects(obj)
    mockMethodCalled++
    return stub
  })

  util.addProperty(stub, 'mock', () => mockContext)

  if (!accessType)
    stub.callsFake(originalFn)

  return stub as any
}

export const fn = spyOn

// TODO make them globally available on some object, like jest.spyOn

// @ts-expect-error
sinon.fn = spyOn
// @ts-expect-error
sinon.spyOn = spyOn
