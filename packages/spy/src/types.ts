export interface MockResultReturn<T> {
  type: 'return'
  /**
   * The value that was returned from the function. If function returned a Promise, then this will be a resolved value.
   */
  value: T
}
export interface MockResultIncomplete {
  type: 'incomplete'
  value: undefined
}
export interface MockResultThrow {
  type: 'throw'
  /**
   * An error that was thrown during function execution.
   */
  value: any
}

export interface MockSettledResultIncomplete {
  type: 'incomplete'
  value: undefined
}

export interface MockSettledResultFulfilled<T> {
  type: 'fulfilled'
  value: T
}

export interface MockSettledResultRejected {
  type: 'rejected'
  value: any
}

export type MockResult<T>
  = | MockResultReturn<T>
    | MockResultThrow
    | MockResultIncomplete
export type MockSettledResult<T>
  = | MockSettledResultFulfilled<T>
    | MockSettledResultRejected
    | MockSettledResultIncomplete

export type MockParameters<T extends Procedure | Constructable> = T extends Constructable
  ? ConstructorParameters<T>
  : T extends Procedure
    ? Parameters<T> : never

export type MockReturnType<T extends Procedure | Constructable> = T extends Constructable
  ? void
  : T extends Procedure
    ? ReturnType<T> : never

export type MockProcedureContext<T extends Procedure | Constructable> = T extends Constructable
  ? InstanceType<T>
  : ThisParameterType<T>

export interface MockContext<T extends Procedure | Constructable = Procedure> {
  /**
   * This is an array containing all arguments for each call. One item of the array is the arguments of that call.
   *
   * @see https://vitest.dev/api/mock#mock-calls
   * @example
   * const fn = vi.fn()
   *
   * fn('arg1', 'arg2')
   * fn('arg3')
   *
   * fn.mock.calls === [
   *   ['arg1', 'arg2'], // first call
   *   ['arg3'], // second call
   * ]
   */
  calls: MockParameters<T>[]
  /**
   * This is an array containing all instances that were instantiated when mock was called with a `new` keyword. Note that this is an actual context (`this`) of the function, not a return value.
   * @see https://vitest.dev/api/mock#mock-instances
   */
  instances: MockReturnType<T>[]
  /**
   * An array of `this` values that were used during each call to the mock function.
   * @see https://vitest.dev/api/mock#mock-contexts
   */
  contexts: MockProcedureContext<T>[]
  /**
   * The order of mock's execution. This returns an array of numbers which are shared between all defined mocks.
   *
   * @see https://vitest.dev/api/mock#mock-invocationcallorder
   * @example
   * const fn1 = vi.fn()
   * const fn2 = vi.fn()
   *
   * fn1()
   * fn2()
   * fn1()
   *
   * fn1.mock.invocationCallOrder === [1, 3]
   * fn2.mock.invocationCallOrder === [2]
   */
  invocationCallOrder: number[]
  /**
   * This is an array containing all values that were `returned` from the function.
   *
   * The `value` property contains the returned value or thrown error. If the function returned a `Promise`, then `result` will always be `'return'` even if the promise was rejected.
   *
   * @see https://vitest.dev/api/mock#mock-results
   * @example
   * const fn = vi.fn()
   *   .mockReturnValueOnce('result')
   *   .mockImplementationOnce(() => { throw new Error('thrown error') })
   *
   * const result = fn()
   *
   * try {
   *   fn()
   * }
   * catch {}
   *
   * fn.mock.results === [
   *   {
   *     type: 'return',
   *     value: 'result',
   *   },
   *   {
   *     type: 'throw',
   *     value: Error,
   *   },
   * ]
   */
  results: MockResult<MockReturnType<T>>[]
  /**
   * An array containing all values that were `resolved` or `rejected` from the function.
   *
   * This array will be empty if the function was never resolved or rejected.
   *
   * @see https://vitest.dev/api/mock#mock-settledresults
   * @example
   * const fn = vi.fn().mockResolvedValueOnce('result')
   *
   * const result = fn()
   *
   * fn.mock.settledResults === [
   *   {
   *     type: 'incomplete',
   *     value: undefined,
   *   }
   * ]
   * fn.mock.results === [
   *   {
   *     type: 'return',
   *     value: Promise<'result'>,
   *   },
   * ]
   *
   * await result
   *
   * fn.mock.settledResults === [
   *   {
   *     type: 'fulfilled',
   *     value: 'result',
   *   },
   * ]
   */
  settledResults: MockSettledResult<Awaited<MockReturnType<T>>>[]
  /**
   * This contains the arguments of the last call. If spy wasn't called, will return `undefined`.
   * @see https://vitest.dev/api/mock#mock-lastcall
   */
  lastCall: MockParameters<T> | undefined
}

export type Procedure = (...args: any[]) => any
// pick a single function type from function overloads, unions, etc...
export type NormalizedProcedure<T extends Procedure | Constructable> = T extends Constructable
  ? ({
    new (...args: ConstructorParameters<T>): InstanceType<T>
  })
  | ({
    (this: InstanceType<T>, ...args: ConstructorParameters<T>): void
  })
  : T extends Procedure
    ? (...args: Parameters<T>) => ReturnType<T>
    : never

export type Methods<T> = keyof {
  [K in keyof T as T[K] extends Procedure ? K : never]: T[K];
}
export type Properties<T> = {
  [K in keyof T]: T[K] extends Procedure ? never : K;
}[keyof T]
& (string | symbol)
export type Classes<T> = {
  [K in keyof T]: T[K] extends new (...args: any[]) => any ? K : never;
}[keyof T]
& (string | symbol)

/*
cf. https://typescript-eslint.io/rules/method-signature-style/

Typescript assignability is different between
  { foo: (f: T) => U } (this is "method-signature-style")
and
  { foo(f: T): U }

Jest uses the latter for `MockInstance.mockImplementation` etc... and it allows assignment such as:
  const boolFn: Jest.Mock<() => boolean> = jest.fn<() => true>(() => true)
*/
/* eslint-disable ts/method-signature-style */
export interface MockInstance<T extends Procedure | Constructable = Procedure> extends Disposable {
  /**
   * Use it to return the name assigned to the mock with the `.mockName(name)` method. By default, it will return `vi.fn()`.
   * @see https://vitest.dev/api/mock#getmockname
   */
  getMockName(): string
  /**
   * Sets the internal mock name. This is useful for identifying the mock when an assertion fails.
   * @see https://vitest.dev/api/mock#mockname
   */
  mockName(name: string): this
  /**
   * Current context of the mock. It stores information about all invocation calls, instances, and results.
   */
  mock: MockContext<T>
  /**
   * Clears all information about every call. After calling it, all properties on `.mock` will return to their initial state. This method does not reset implementations. It is useful for cleaning up mocks between different assertions.
   *
   * To automatically call this method before each test, enable the [`clearMocks`](https://vitest.dev/config/#clearmocks) setting in the configuration.
   * @see https://vitest.dev/api/mock#mockclear
   */
  mockClear(): this
  /**
   * Does what `mockClear` does and resets inner implementation to the original function. This also resets all "once" implementations.
   *
   * Note that resetting a mock from `vi.fn()` will set implementation to an empty function that returns `undefined`.
   * Resetting a mock from `vi.fn(impl)` will set implementation to `impl`. It is useful for completely resetting a mock to its default state.
   *
   * To automatically call this method before each test, enable the [`mockReset`](https://vitest.dev/config/#mockreset) setting in the configuration.
   * @see https://vitest.dev/api/mock#mockreset
   */
  mockReset(): this
  /**
   * Does what `mockReset` does and restores original descriptors of spied-on objects.
   * @see https://vitest.dev/api/mock#mockrestore
   */
  mockRestore(): void
  /**
   * Returns current permanent mock implementation if there is one.
   *
   * If mock was created with `vi.fn`, it will consider passed down method as a mock implementation.
   *
   * If mock was created with `vi.spyOn`, it will return `undefined` unless a custom implementation was provided.
   */
  getMockImplementation(): NormalizedProcedure<T> | undefined
  /**
   * Accepts a function to be used as the mock implementation. TypeScript expects the arguments and return type to match those of the original function.
   * @see https://vitest.dev/api/mock#mockimplementation
   * @example
   * const increment = vi.fn().mockImplementation(count => count + 1);
   * expect(increment(3)).toBe(4);
   */
  mockImplementation(fn: NormalizedProcedure<T>): this
  /**
   * Accepts a function to be used as the mock implementation. TypeScript expects the arguments and return type to match those of the original function. This method can be chained to produce different results for multiple function calls.
   *
   * When the mocked function runs out of implementations, it will invoke the default implementation set with `vi.fn(() => defaultValue)` or `.mockImplementation(() => defaultValue)` if they were called.
   * @see https://vitest.dev/api/mock#mockimplementationonce
   * @example
   * const fn = vi.fn(count => count).mockImplementationOnce(count => count + 1);
   * expect(fn(3)).toBe(4);
   * expect(fn(3)).toBe(3);
   */
  mockImplementationOnce(fn: NormalizedProcedure<T>): this
  /**
   * Overrides the original mock implementation temporarily while the callback is being executed.
   *
   * Note that this method takes precedence over the [`mockImplementationOnce`](https://vitest.dev/api/mock#mockimplementationonce).
   * @see https://vitest.dev/api/mock#withimplementation
   * @example
   * const myMockFn = vi.fn(() => 'original')
   *
   * myMockFn.withImplementation(() => 'temp', () => {
   *   myMockFn() // 'temp'
   * })
   *
   * myMockFn() // 'original'
   */
  withImplementation<T2>(fn: NormalizedProcedure<T>, cb: () => T2): T2 extends Promise<unknown> ? Promise<this> : this

  /**
   * Use this if you need to return the `this` context from the method without invoking the actual implementation.
   * @see https://vitest.dev/api/mock#mockreturnthis
   */
  mockReturnThis(): this
  /**
   * Accepts a value that will be returned whenever the mock function is called. TypeScript will only accept values that match the return type of the original function.
   * @see https://vitest.dev/api/mock#mockreturnvalue
   * @example
   * const mock = vi.fn()
   * mock.mockReturnValue(42)
   * mock() // 42
   * mock.mockReturnValue(43)
   * mock() // 43
   */
  mockReturnValue(value: MockReturnType<T>): this
  /**
   * Accepts a value that will be returned whenever the mock function is called. TypeScript will only accept values that match the return type of the original function.
   *
   * When the mocked function runs out of implementations, it will invoke the default implementation set with `vi.fn(() => defaultValue)` or `.mockImplementation(() => defaultValue)` if they were called.
   * @example
   * const myMockFn = vi
   *   .fn()
   *   .mockReturnValue('default')
   *   .mockReturnValueOnce('first call')
   *   .mockReturnValueOnce('second call')
   *
   * // 'first call', 'second call', 'default'
   * console.log(myMockFn(), myMockFn(), myMockFn())
   */
  mockReturnValueOnce(value: MockReturnType<T>): this
  /**
   * Accepts a value that will be resolved when the async function is called. TypeScript will only accept values that match the return type of the original function.
   * @example
   * const asyncMock = vi.fn().mockResolvedValue(42)
   * asyncMock() // Promise<42>
   */
  mockResolvedValue(value: Awaited<MockReturnType<T>>): this
  /**
   * Accepts a value that will be resolved during the next function call. TypeScript will only accept values that match the return type of the original function. If chained, each consecutive call will resolve the specified value.
   * @example
   * const myMockFn = vi
   *   .fn()
   *   .mockResolvedValue('default')
   *   .mockResolvedValueOnce('first call')
   *   .mockResolvedValueOnce('second call')
   *
   * // Promise<'first call'>, Promise<'second call'>, Promise<'default'>
   * console.log(myMockFn(), myMockFn(), myMockFn())
   */
  mockResolvedValueOnce(value: Awaited<MockReturnType<T>>): this
  /**
   * Accepts an error that will be rejected when async function is called.
   * @example
   * const asyncMock = vi.fn().mockRejectedValue(new Error('Async error'))
   * await asyncMock() // throws Error<'Async error'>
   */
  mockRejectedValue(error: unknown): this
  /**
   * Accepts a value that will be rejected during the next function call. If chained, each consecutive call will reject the specified value.
   * @example
   * const asyncMock = vi
   *   .fn()
   *   .mockResolvedValueOnce('first call')
   *   .mockRejectedValueOnce(new Error('Async error'))
   *
   * await asyncMock() // first call
   * await asyncMock() // throws Error<'Async error'>
   */
  mockRejectedValueOnce(error: unknown): this
}
/* eslint-enable ts/method-signature-style */

export interface Mock<T extends Procedure | Constructable = Procedure> extends MockInstance<T> {
  new (...args: MockParameters<T>): T extends Constructable ? InstanceType<T> : MockReturnType<T>
  (...args: MockParameters<T>): MockReturnType<T>
  /** @internal */
  _isMockFunction: true
}

type PartialMaybePromise<T> = T extends Promise<Awaited<T>>
  ? Promise<Partial<Awaited<T>>>
  : Partial<T>

export interface PartialMock<T extends Procedure = Procedure>
  extends MockInstance<
    (...args: Parameters<T>) => PartialMaybePromise<ReturnType<T>>
  > {
  new (...args: Parameters<T>): ReturnType<T>
  (...args: Parameters<T>): ReturnType<T>
}

export type MaybeMockedConstructor<T> = T extends new (
  ...args: Array<any>
) => infer R
  ? Mock<(...args: ConstructorParameters<T>) => R>
  : T
export type MockedFunction<T extends Procedure> = Mock<T> & {
  [K in keyof T]: T[K];
}
export type PartiallyMockedFunction<T extends Procedure> = PartialMock<T> & {
  [K in keyof T]: T[K];
}
export type MockedFunctionDeep<T extends Procedure> = Mock<T>
  & MockedObjectDeep<T>
export type PartiallyMockedFunctionDeep<T extends Procedure> = PartialMock<T>
  & MockedObjectDeep<T>
export type MockedObject<T> = MaybeMockedConstructor<T> & {
  [K in Methods<T>]: T[K] extends Procedure ? MockedFunction<T[K]> : T[K];
} & { [K in Properties<T>]: T[K] }
export type MockedObjectDeep<T> = MaybeMockedConstructor<T> & {
  [K in Methods<T>]: T[K] extends Procedure ? MockedFunctionDeep<T[K]> : T[K];
} & { [K in Properties<T>]: MaybeMockedDeep<T[K]> }

export type MaybeMockedDeep<T> = T extends Procedure
  ? MockedFunctionDeep<T>
  : T extends object
    ? MockedObjectDeep<T>
    : T

export type MaybePartiallyMockedDeep<T> = T extends Procedure
  ? PartiallyMockedFunctionDeep<T>
  : T extends object
    ? MockedObjectDeep<T>
    : T

export type MaybeMocked<T> = T extends Procedure
  ? MockedFunction<T>
  : T extends object
    ? MockedObject<T>
    : T

export type MaybePartiallyMocked<T> = T extends Procedure
  ? PartiallyMockedFunction<T>
  : T extends object
    ? MockedObject<T>
    : T

export interface Constructable {
  new (...args: any[]): any
}

export type MockedClass<T extends Constructable> = MockInstance<
  (...args: ConstructorParameters<T>) => InstanceType<T>
> & {
  prototype: T extends { prototype: any } ? Mocked<T['prototype']> : never
} & T

export type Mocked<T> = {
  [P in keyof T]: T[P] extends Procedure
    ? MockInstance<T[P]>
    : T[P] extends Constructable
      ? MockedClass<T[P]>
      : T[P];
} & T

export interface MockConfig {
  mockImplementation: Procedure | Constructable | undefined
  mockOriginal: Procedure | Constructable | undefined
  mockName: string
  onceMockImplementations: Array<Procedure | Constructable>
}

export interface MockInstanceOption {
  originalImplementation?: Procedure | Constructable
  mockImplementation?: Procedure | Constructable
  resetToMockImplementation?: boolean
  restore?: () => void
  prototypeMembers?: (string | symbol)[]
  keepMembersImplementation?: boolean
  prototypeState?: MockContext
  prototypeConfig?: MockConfig
  resetToMockName?: boolean
  name?: string | symbol
}
