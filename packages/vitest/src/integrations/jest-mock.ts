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

export type MockableFunction = (...args: Array<any>) => any
export type MethodKeysOf<T> = {
  [K in keyof T]: T[K] extends MockableFunction ? K : never;
}[keyof T]
export type PropertyKeysOf<T> = {
  [K in keyof T]: T[K] extends MockableFunction ? never : K;
}[keyof T]

export type ArgumentsOf<T> = T extends (...args: infer A) => any ? A : never

export type ConstructorArgumentsOf<T> = T extends new (...args: infer A) => any
  ? A
  : never
export type MaybeMockedConstructor<T> = T extends new (
  ...args: Array<any>
) => infer R
  ? JestMockCompatFn<ConstructorArgumentsOf<T>, R>
  : T
export type MockedFunction<T extends MockableFunction> = MockWithArgs<T> & {
  [K in keyof T]: T[K];
}
export type MockedFunctionDeep<T extends MockableFunction> = MockWithArgs<T> &
MockedObjectDeep<T>
export type MockedObject<T> = MaybeMockedConstructor<T> & {
  [K in MethodKeysOf<T>]: T[K] extends MockableFunction
    ? MockedFunction<T[K]>
    : T[K];
} & {[K in PropertyKeysOf<T>]: T[K]}
export type MockedObjectDeep<T> = MaybeMockedConstructor<T> & {
  [K in MethodKeysOf<T>]: T[K] extends MockableFunction
    ? MockedFunctionDeep<T[K]>
    : T[K];
} & {[K in PropertyKeysOf<T>]: MaybeMockedDeep<T[K]>}

export type MaybeMockedDeep<T> = T extends MockableFunction
  ? MockedFunctionDeep<T>
  : T extends object
    ? MockedObjectDeep<T>
    : T

export type MaybeMocked<T> = T extends MockableFunction
  ? MockedFunction<T>
  : T extends object
    ? MockedObject<T>
    : T

export type EnhancedSpy<TArgs extends any[] = any[], TReturns = any> = JestMockCompat<TArgs, TReturns> & SpyImpl<TArgs, TReturns>

export interface MockWithArgs<T extends MockableFunction>
  extends JestMockCompatFn<ArgumentsOf<T>, ReturnType<T>> {
  new (...args: ConstructorArgumentsOf<T>): T
  (...args: ArgumentsOf<T>): ReturnType<T>
}

export const spies = new Set<JestMockCompat>()

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
  const stub = spy as unknown as EnhancedSpy<TArgs, TReturns>

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

  let name: string = (stub as any).name

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
    implementation = () => undefined as unknown as TReturns
    onceImplementations = []
    return stub
  }

  stub.mockRestore = () => {
    stub.mockReset()
    implementation = undefined
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
    stub.mockImplementationOnce(() => Promise.reject(val))

  util.addProperty(stub, 'mock', () => mockContext)

  stub.willCall(function(this: unknown, ...args) {
    instances.push(this)
    const impl = onceImplementations.shift() || implementation || stub.getOriginal() || (() => {})
    return impl.apply(this, args)
  })

  spies.add(stub)

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
