import { util } from 'chai'
import type { SpyImpl } from 'tinyspy'
import * as tinyspy from 'tinyspy'

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
  // TODO: doesn't work
  invocationCallOrder: number[]
  results: MockResult<T>[]
}

export interface JestMockCompat<TArgs extends any[] = any[], TReturns = any> {
  getMockName(): string
  mockName(n: string): this
  mock: JestMockCompatContext<TArgs, TReturns>
  mockClear(): this
  mockReset(): this
  mockRestore(): void
  getMockImplementation(): ((...args: TArgs) => TReturns) | undefined
  mockImplementation(fn: ((...args: TArgs) => TReturns) | (() => Promise<TReturns>)): this
  mockImplementationOnce(fn: ((...args: TArgs) => TReturns) | (() => Promise<TReturns>)): this
  mockReturnThis(): this
  mockReturnValue(obj: TReturns): this
  mockReturnValueOnce(obj: TReturns): this
  mockResolvedValue(obj: Awaited<TReturns>): this
  mockResolvedValueOnce(obj: Awaited<TReturns>): this
  mockRejectedValue(obj: any): this
  mockRejectedValueOnce(obj: any): this
}

export interface JestMockCompatFn<TArgs extends any[] = any, TReturns = any> extends JestMockCompat<TArgs, TReturns> {
  (...args: TArgs): TReturns
}

export function spyOn<T, K extends keyof T>(
  obj: T,
  method: K,
  accessType?: 'get' | 'set',
): T[K] extends (...args: infer TArgs) => infer TReturnValue
    ? JestMockCompat<TArgs, TReturnValue> : JestMockCompat {
  const dictionary = {
    get: 'getter',
    set: 'setter',
  } as const
  const objMethod = accessType ? { [dictionary[accessType]]: method } : method

  const stub = tinyspy.spyOn(obj, objMethod as any)

  return enhanceSpy(stub) as any
}

type Awaited<T> = T extends Promise<infer R> ? R : never

function enhanceSpy<TArgs extends any[], TReturns>(
  spy: SpyImpl<TArgs, TReturns>,
): JestMockCompat<TArgs, TReturns> {
  const stub = spy as unknown as JestMockCompat<TArgs, TReturns> & SpyImpl<TArgs, TReturns>

  let implementation: ((...args: TArgs) => TReturns) | undefined

  const instances: any[] = []

  const mockContext = {
    get calls() {
      return stub.calls
    },
    get instances() {
      return instances
    },
    // not supported
    get invocationCallOrder() {
      return []
    },
    get results() {
      return stub.results.map(([callType, value]) => {
        const type = callType === 'error' ? 'throw' : 'return'
        return { type, value }
      })
    },
  }

  let onceImplementations: ((...args: TArgs) => TReturns)[] = []

  let name = ''

  Object.defineProperty(stub, 'name', {
    get: () => name,
  })

  stub.getMockName = () => name || 'vi.fn()'
  stub.mockName = (n) => {
    name = n
    return stub
  }

  stub.mockClear = () => {
    stub.reset()
    return stub
  }

  stub.mockReset = () => {
    stub.reset()
    return stub
  }

  stub.mockRestore = () => {
    implementation = undefined
    onceImplementations = []
    stub.reset()
    ;(stub as unknown as SpyImpl).restore()
    return stub
  }

  stub.getMockImplementation = () => implementation
  stub.mockImplementation = (fn: (...args: TArgs) => TReturns) => {
    implementation = fn
    return stub
  }

  stub.mockImplementationOnce = (fn: (...args: TArgs) => TReturns) => {
    onceImplementations.push(fn)
    return stub
  }

  stub.mockReturnThis = () =>
    stub.mockImplementation(function(this: TReturns) {
      return this
    })

  stub.mockReturnValue = (val: TReturns) => stub.mockImplementation(() => val)
  stub.mockReturnValueOnce = (val: TReturns) => stub.mockImplementationOnce(() => val)

  stub.mockResolvedValue = (val: Awaited<TReturns>) =>
    stub.mockImplementation(() => Promise.resolve(val as TReturns))

  stub.mockResolvedValueOnce = (val: Awaited<TReturns>) =>
    stub.mockImplementationOnce(() => Promise.resolve(val as TReturns))

  stub.mockRejectedValue = (val: unknown) =>
    stub.mockImplementation(() => Promise.reject(val))

  stub.mockRejectedValueOnce = (val: unknown) =>
    stub.mockImplementation(() => Promise.reject(val))

  util.addProperty(stub, 'mock', () => mockContext)

  stub.willCall(function(this: unknown, ...args) {
    instances.push(this)
    const impl = onceImplementations.shift() || implementation || stub.getOriginal() || (() => {})
    return impl.apply(this, args)
  })

  return stub as any
}

export function fn<TArgs extends any[] = any[], R = any>(): JestMockCompatFn<TArgs, R>
export function fn<TArgs extends any[] = any[], R = any>(
  implementation: (...args: TArgs) => R
): JestMockCompatFn<TArgs, R>
export function fn<TArgs extends any[] = any[], R = any>(
  implementation?: (...args: TArgs) => R,
): JestMockCompatFn<TArgs, R> {
  return enhanceSpy(tinyspy.spyOn({ fn: implementation || (() => {}) }, 'fn')) as unknown as JestMockCompatFn
}
