/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { MockInstance } from '@vitest/spy'
import type { Constructable } from '@vitest/utils'
import type { Formatter } from 'tinyrainbow'
import type { AsymmetricMatcher } from './jest-asymmetric-matchers'
import type { diff, getMatcherUtils, stringify } from './jest-matcher-utils'

export type ChaiPlugin = Chai.ChaiPlugin

export type Tester = (
  this: TesterContext,
  a: any,
  b: any,
  customTesters: Array<Tester>
) => boolean | undefined

export interface TesterContext {
  equals: (
    a: unknown,
    b: unknown,
    customTesters?: Array<Tester>,
    strictCheck?: boolean
  ) => boolean
}
export type { DiffOptions } from '@vitest/utils/diff'

export interface MatcherHintOptions {
  comment?: string
  expectedColor?: Formatter
  isDirectExpectCall?: boolean
  isNot?: boolean
  promise?: string
  receivedColor?: Formatter
  secondArgument?: string
  secondArgumentColor?: Formatter
}

export interface MatcherState {
  customTesters: Array<Tester>
  assertionCalls: number
  currentTestName?: string
  dontThrow?: () => void
  error?: Error
  equals: (
    a: unknown,
    b: unknown,
    customTesters?: Array<Tester>,
    strictCheck?: boolean
  ) => boolean
  expand?: boolean
  expectedAssertionsNumber?: number | null
  expectedAssertionsNumberErrorGen?: (() => Error) | null
  isExpectingAssertions?: boolean
  isExpectingAssertionsError?: Error | null
  isNot: boolean
  // environment: VitestEnvironment
  promise: string
  // snapshotState: SnapshotState
  suppressedErrors: Array<Error>
  testPath?: string
  utils: ReturnType<typeof getMatcherUtils> & {
    diff: typeof diff
    stringify: typeof stringify
    iterableEquality: Tester
    subsetEquality: Tester
  }
  soft?: boolean
  poll?: boolean
}

export interface SyncExpectationResult {
  pass: boolean
  message: () => string
  actual?: any
  expected?: any
}

export type AsyncExpectationResult = Promise<SyncExpectationResult>

export type ExpectationResult = SyncExpectationResult | AsyncExpectationResult

export interface RawMatcherFn<T extends MatcherState = MatcherState, E extends Array<any> = Array<any>> {
  (this: T, received: any, ...expected: E): ExpectationResult
}

// Allow unused `T` to preserve its name for extensions.
// Type parameter names must be identical when extending those types.
// eslint-disable-next-line
export interface Matchers<T = any> {}

export type MatchersObject<T extends MatcherState = MatcherState> = Record<
  string,
  RawMatcherFn<T>
> & ThisType<T> & {
  [K in keyof Matchers<T>]?: RawMatcherFn<T, Parameters<Matchers<T>[K]>>
}

export interface ExpectStatic
  extends Chai.ExpectStatic,
  Matchers,
  AsymmetricMatchersContaining {
  <T>(actual: T, message?: string): Assertion<T>
  extend: (expects: MatchersObject) => void
  anything: () => any
  any: (constructor: unknown) => any
  getState: () => MatcherState
  setState: (state: Partial<MatcherState>) => void
  not: AsymmetricMatchersContaining
}

interface CustomMatcher {
  /**
   * Checks that a value satisfies a custom matcher function.
   *
   * @param matcher - A function returning a boolean based on the custom condition
   * @param message - Optional custom error message on failure
   *
   * @example
   * expect(age).toSatisfy(val => val >= 18, 'Age must be at least 18');
   * expect(age).toEqual(expect.toSatisfy(val => val >= 18, 'Age must be at least 18'));
   */
  toSatisfy: (matcher: (value: any) => boolean, message?: string) => any

  /**
   * Matches if the received value is one of the values in the expected array.
   *
   * @example
   * expect(1).toBeOneOf([1, 2, 3])
   * expect('foo').toBeOneOf([expect.any(String)])
   * expect({ a: 1 }).toEqual({ a: expect.toBeOneOf(['1', '2', '3']) })
   */
  toBeOneOf: <T>(sample: Array<T>) => any
}

export interface AsymmetricMatchersContaining extends CustomMatcher {
  /**
   * Matches if the received string contains the expected substring.
   *
   * @example
   * expect('I have an apple').toEqual(expect.stringContaining('apple'));
   * expect({ a: 'test string' }).toEqual({ a: expect.stringContaining('test') });
   */
  stringContaining: (expected: string) => any

  /**
   * Matches if the received object contains all properties of the expected object.
   *
   * @example
   * expect({ a: '1', b: 2 }).toEqual(expect.objectContaining({ a: '1' }))
   */
  objectContaining: <T = any>(expected: DeeplyAllowMatchers<T>) => any

  /**
   * Matches if the received array contains all elements in the expected array.
   *
   * @example
   * expect(['a', 'b', 'c']).toEqual(expect.arrayContaining(['b', 'a']));
   */
  arrayContaining: <T = unknown>(expected: Array<DeeplyAllowMatchers<T>>) => any

  /**
   * Matches if the received string or regex matches the expected pattern.
   *
   * @example
   * expect('hello world').toEqual(expect.stringMatching(/^hello/));
   * expect('hello world').toEqual(expect.stringMatching('hello'));
   */
  stringMatching: (expected: string | RegExp) => any

  /**
   * Matches if the received number is within a certain precision of the expected number.
   *
   * @param precision - Optional decimal precision for comparison. Default is 2.
   *
   * @example
   * expect(10.45).toEqual(expect.closeTo(10.5, 1));
   * expect(5.11).toEqual(expect.closeTo(5.12)); // with default precision
   */
  closeTo: (expected: number, precision?: number) => any
}

type WithAsymmetricMatcher<T> = T | AsymmetricMatcher<unknown>

export type DeeplyAllowMatchers<T> = T extends Array<infer Element>
  ? WithAsymmetricMatcher<T> | DeeplyAllowMatchers<Element>[]
  : T extends object
    ? WithAsymmetricMatcher<T> | { [K in keyof T]: DeeplyAllowMatchers<T[K]> }
    : WithAsymmetricMatcher<T>

export interface JestAssertion<T = any, R = void> extends jest.Matchers<R, T>, CustomMatcher {
  /**
   * Used when you want to check that two objects have the same value.
   * This matcher recursively checks the equality of all fields, rather than checking for object identity.
   *
   * @example
   * expect(user).toEqual({ name: 'Alice', age: 30 });
   */
  toEqual: <E>(expected: E) => R

  /**
   * Use to test that objects have the same types as well as structure.
   *
   * @example
   * expect(user).toStrictEqual({ name: 'Alice', age: 30 });
   */
  toStrictEqual: <E>(expected: E) => R

  /**
   * Checks that a value is what you expect. It calls `Object.is` to compare values.
   * Don't use `toBe` with floating-point numbers.
   *
   * @example
   * expect(result).toBe(42);
   * expect(status).toBe(true);
   */
  toBe: <E>(expected: E) => R

  /**
   * Check that a string matches a regular expression.
   *
   * @example
   * expect(message).toMatch(/hello/);
   * expect(greeting).toMatch('world');
   */
  toMatch: (expected: string | RegExp) => R

  /**
   * Used to check that a JavaScript object matches a subset of the properties of an object
   *
   * @example
   * expect(user).toMatchObject({
   *   name: 'Alice',
   *   address: { city: 'Wonderland' }
   * });
   */
  toMatchObject: <E extends object | any[]>(expected: E) => R

  /**
   * Used when you want to check that an item is in a list.
   * For testing the items in the list, this uses `===`, a strict equality check.
   *
   * @example
   * expect(items).toContain('apple');
   * expect(numbers).toContain(5);
   */
  toContain: <E>(item: E) => R

  /**
   * Used when you want to check that an item is in a list.
   * For testing the items in the list, this matcher recursively checks the
   * equality of all fields, rather than checking for object identity.
   *
   * @example
   * expect(items).toContainEqual({ name: 'apple', quantity: 1 });
   */
  toContainEqual: <E>(item: E) => R

  /**
   * Use when you don't care what a value is, you just want to ensure a value
   * is true in a boolean context. In JavaScript, there are six falsy values:
   * `false`, `0`, `''`, `null`, `undefined`, and `NaN`. Everything else is truthy.
   *
   * @example
   * expect(user.isActive).toBeTruthy();
   */
  toBeTruthy: () => R

  /**
   * When you don't care what a value is, you just want to
   * ensure a value is false in a boolean context.
   *
   * @example
   * expect(user.isActive).toBeFalsy();
   */
  toBeFalsy: () => R

  /**
   * For comparing floating point numbers.
   *
   * @example
   * expect(score).toBeGreaterThan(10);
   */
  toBeGreaterThan: (num: number | bigint) => R

  /**
   * For comparing floating point numbers.
   *
   * @example
   * expect(score).toBeGreaterThanOrEqual(10);
   */
  toBeGreaterThanOrEqual: (num: number | bigint) => R

  /**
   * For comparing floating point numbers.
   *
   * @example
   * expect(score).toBeLessThan(10);
   */
  toBeLessThan: (num: number | bigint) => R

  /**
   * For comparing floating point numbers.
   *
   * @example
   * expect(score).toBeLessThanOrEqual(10);
   */
  toBeLessThanOrEqual: (num: number | bigint) => R

  /**
   * Used to check that a variable is NaN.
   *
   * @example
   * expect(value).toBeNaN();
   */
  toBeNaN: () => R

  /**
   * Used to check that a variable is undefined.
   *
   * @example
   * expect(value).toBeUndefined();
   */
  toBeUndefined: () => R

  /**
   * This is the same as `.toBe(null)` but the error messages are a bit nicer.
   * So use `.toBeNull()` when you want to check that something is null.
   *
   * @example
   * expect(value).toBeNull();
   */
  toBeNull: () => R

  /**
   * Ensure that a variable is not undefined.
   *
   * @example
   * expect(value).toBeDefined();
   */
  toBeDefined: () => R

  /**
   * Ensure that an object is an instance of a class.
   * This matcher uses `instanceof` underneath.
   *
   * @example
   * expect(new Date()).toBeInstanceOf(Date);
   */
  toBeInstanceOf: <E>(expected: E) => R

  /**
   * Used to check that an object has a `.length` property
   * and it is set to a certain numeric value.
   *
   * @example
   * expect([1, 2, 3]).toHaveLength(3);
   * expect('hello').toHaveLength(5);
   */
  toHaveLength: (length: number) => R

  /**
   * Use to check if a property at the specified path exists on an object.
   * For checking deeply nested properties, you may use dot notation or an array containing
   * the path segments for deep references.
   *
   * Optionally, you can provide a value to check if it matches the value present at the path
   * on the target object. This matcher uses 'deep equality' (like `toEqual()`) and recursively checks
   * the equality of all fields.
   *
   * @example
   * expect(user).toHaveProperty('address.city', 'New York');
   * expect(config).toHaveProperty(['settings', 'theme'], 'dark');
   */
  toHaveProperty: <E>(
    property: string | (string | number)[],
    value?: E
  ) => R

  /**
   * Using exact equality with floating point numbers is a bad idea.
   * Rounding means that intuitive things fail.
   * The default for `precision` is 2.
   *
   * @example
   * expect(price).toBeCloseTo(9.99, 2);
   */
  toBeCloseTo: (number: number, numDigits?: number) => R

  /**
   * Ensures that a mock function is called an exact number of times.
   *
   * Also under the alias `expect.toBeCalledTimes`.
   *
   * @example
   * expect(mockFunc).toHaveBeenCalledTimes(2);
   */
  toHaveBeenCalledTimes: (times: number) => R

  /**
   * Ensures that a mock function is called an exact number of times.
   *
   * Alias for `expect.toHaveBeenCalledTimes`.
   *
   * @example
   * expect(mockFunc).toBeCalledTimes(2);
   */
  toBeCalledTimes: (times: number) => R

  /**
   * Ensures that a mock function is called.
   *
   * Also under the alias `expect.toBeCalled`.
   *
   * @example
   * expect(mockFunc).toHaveBeenCalled();
   */

  toHaveBeenCalled: () => R

  /**
   * Ensures that a mock function is called.
   *
   * Alias for `expect.toHaveBeenCalled`.
   *
   * @example
   * expect(mockFunc).toBeCalled();
   */
  toBeCalled: () => R

  /**
   * Ensure that a mock function is called with specific arguments.
   *
   * Also under the alias `expect.toBeCalledWith`.
   *
   * @example
   * expect(mockFunc).toHaveBeenCalledWith('arg1', 42);
   */
  toHaveBeenCalledWith: <E extends any[]>(...args: E) => R

  /**
   * Ensure that a mock function is called with specific arguments.
   *
   * Alias for `expect.toHaveBeenCalledWith`.
   *
   * @example
   * expect(mockFunc).toBeCalledWith('arg1', 42);
   */
  toBeCalledWith: <E extends any[]>(...args: E) => R

  /**
   * Ensure that a mock function is called with specific arguments on an Nth call.
   *
   * Also under the alias `expect.nthCalledWith`.
   *
   * @example
   * expect(mockFunc).toHaveBeenNthCalledWith(2, 'secondArg');
   */
  toHaveBeenNthCalledWith: <E extends any[]>(n: number, ...args: E) => R

  /**
   * Ensure that a mock function is called with specific arguments on an Nth call.
   *
   * Alias for `expect.toHaveBeenNthCalledWith`.
   *
   * @example
   * expect(mockFunc).nthCalledWith(2, 'secondArg');
   */
  nthCalledWith: <E extends any[]>(nthCall: number, ...args: E) => R

  /**
   * If you have a mock function, you can use `.toHaveBeenLastCalledWith`
   * to test what arguments it was last called with.
   *
   * Also under the alias `expect.lastCalledWith`.
   *
   * @example
   * expect(mockFunc).toHaveBeenLastCalledWith('lastArg');
   */
  toHaveBeenLastCalledWith: <E extends any[]>(...args: E) => R

  /**
   * If you have a mock function, you can use `.lastCalledWith`
   * to test what arguments it was last called with.
   *
   * Alias for `expect.toHaveBeenLastCalledWith`.
   *
   * @example
   * expect(mockFunc).lastCalledWith('lastArg');
   */
  lastCalledWith: <E extends any[]>(...args: E) => R

  /**
   * Used to test that a function throws when it is called.
   *
   * Also under the alias `expect.toThrowError`.
   *
   * @example
   * expect(() => functionWithError()).toThrow('Error message');
   * expect(() => parseJSON('invalid')).toThrow(SyntaxError);
   */
  toThrow: (expected?: string | Constructable | RegExp | Error) => R

  /**
   * Used to test that a function throws when it is called.
   *
   * Alias for `expect.toThrow`.
   *
   * @example
   * expect(() => functionWithError()).toThrowError('Error message');
   * expect(() => parseJSON('invalid')).toThrowError(SyntaxError);
   */
  toThrowError: (expected?: string | Constructable | RegExp | Error) => R

  /**
   * Use to test that the mock function successfully returned (i.e., did not throw an error) at least one time
   *
   * Alias for `expect.toHaveReturned`.
   *
   * @example
   * expect(mockFunc).toReturn();
   */
  toReturn: () => R

  /**
   * Use to test that the mock function successfully returned (i.e., did not throw an error) at least one time
   *
   * Also under the alias `expect.toReturn`.
   *
   * @example
   * expect(mockFunc).toHaveReturned();
   */
  toHaveReturned: () => R

  /**
   * Use to ensure that a mock function returned successfully (i.e., did not throw an error) an exact number of times.
   * Any calls to the mock function that throw an error are not counted toward the number of times the function returned.
   *
   * Alias for `expect.toHaveReturnedTimes`.
   *
   * @example
   * expect(mockFunc).toReturnTimes(3);
   */
  toReturnTimes: (times: number) => R

  /**
   * Use to ensure that a mock function returned successfully (i.e., did not throw an error) an exact number of times.
   * Any calls to the mock function that throw an error are not counted toward the number of times the function returned.
   *
   * Also under the alias `expect.toReturnTimes`.
   *
   * @example
   * expect(mockFunc).toHaveReturnedTimes(3);
   */
  toHaveReturnedTimes: (times: number) => R

  /**
   * Use to ensure that a mock function returned a specific value.
   *
   * Alias for `expect.toHaveReturnedWith`.
   *
   * @example
   * expect(mockFunc).toReturnWith('returnValue');
   */
  toReturnWith: <E>(value: E) => R

  /**
   * Use to ensure that a mock function returned a specific value.
   *
   * Also under the alias `expect.toReturnWith`.
   *
   * @example
   * expect(mockFunc).toHaveReturnedWith('returnValue');
   */
  toHaveReturnedWith: <E>(value: E) => R

  /**
   * Use to test the specific value that a mock function last returned.
   * If the last call to the mock function threw an error, then this matcher will fail
   * no matter what value you provided as the expected return value.
   *
   * Also under the alias `expect.lastReturnedWith`.
   *
   * @example
   * expect(mockFunc).toHaveLastReturnedWith('lastValue');
   */
  toHaveLastReturnedWith: <E>(value: E) => R

  /**
   * Use to test the specific value that a mock function last returned.
   * If the last call to the mock function threw an error, then this matcher will fail
   * no matter what value you provided as the expected return value.
   *
   * Alias for `expect.toHaveLastReturnedWith`.
   *
   * @example
   * expect(mockFunc).lastReturnedWith('lastValue');
   */
  lastReturnedWith: <E>(value: E) => R

  /**
   * Use to test the specific value that a mock function returned for the nth call.
   * If the nth call to the mock function threw an error, then this matcher will fail
   * no matter what value you provided as the expected return value.
   *
   * Also under the alias `expect.nthReturnedWith`.
   *
   * @example
   * expect(mockFunc).toHaveNthReturnedWith(2, 'nthValue');
   */
  toHaveNthReturnedWith: <E>(nthCall: number, value: E) => R

  /**
   * Use to test the specific value that a mock function returned for the nth call.
   * If the nth call to the mock function threw an error, then this matcher will fail
   * no matter what value you provided as the expected return value.
   *
   * Alias for `expect.toHaveNthReturnedWith`.
   *
   * @example
   * expect(mockFunc).nthReturnedWith(2, 'nthValue');
   */
  nthReturnedWith: <E>(nthCall: number, value: E) => R
}

type VitestAssertion<A, T, R = void> = {
  [K in keyof A]: A[K] extends Chai.Assertion
    ? R extends Promise<void> ? Promisify<Assertion<T, R>> : Assertion<T, R>
    : A[K] extends (...args: any[]) => any
      ? A[K] // not converting function since they may contain overload
      : VitestAssertion<A[K], T, R>;
} & ((type: string, message?: string) => Assertion<T, R>)

type Promisify<O> = {
  [K in keyof O]: O[K] extends (...args: infer A) => infer R
    ? Promisify<O[K]> & ((...args: A) => Promise<R>)
    : O[K];
}

export type PromisifyAssertion<T> = Assertion<T, Promise<void>>

type MaybePromisify<T, R> = R extends Promise<void> ? Promise<T> : T

export interface Assertion<T = any, R = void>
  extends VitestAssertion<Chai.Assertion, T, R>,
  JestAssertion<T, R>,
  Matchers<MaybePromisify<T, R>> {
  /**
   * Ensures a value is of a specific type.
   *
   * @example
   * expect(value).toBeTypeOf('string');
   * expect(number).toBeTypeOf('number');
   */
  toBeTypeOf: (
    expected:
      | 'bigint'
      | 'boolean'
      | 'function'
      | 'number'
      | 'object'
      | 'string'
      | 'symbol'
      | 'undefined'
  ) => R

  /**
   * Asserts that a mock function was called exactly once.
   *
   * @example
   * expect(mockFunc).toHaveBeenCalledOnce();
   */
  toHaveBeenCalledOnce: () => R

  /**
   * Ensure that a mock function is called with specific arguments and called
   * exactly once.
   *
   * @example
   * expect(mockFunc).toHaveBeenCalledExactlyOnceWith('arg1', 42);
   */
  toHaveBeenCalledExactlyOnceWith: <E extends any[]>(...args: E) => R

  /**
   * This assertion checks if a `Mock` was called before another `Mock`.
   * @param mock - A mock function created by `vi.spyOn` or `vi.fn`
   * @param failIfNoFirstInvocation - Fail if the first mock was never called
   * @example
   * const mock1 = vi.fn()
   * const mock2 = vi.fn()
   *
   * mock1()
   * mock2()
   * mock1()
   *
   * expect(mock1).toHaveBeenCalledBefore(mock2)
   */
  toHaveBeenCalledBefore: (mock: MockInstance, failIfNoFirstInvocation?: boolean) => R

  /**
   * This assertion checks if a `Mock` was called after another `Mock`.
   * @param mock - A mock function created by `vi.spyOn` or `vi.fn`
   * @param failIfNoFirstInvocation - Fail if the first mock was never called
   * @example
   * const mock1 = vi.fn()
   * const mock2 = vi.fn()
   *
   * mock2()
   * mock1()
   * mock2()
   *
   * expect(mock1).toHaveBeenCalledAfter(mock2)
   */
  toHaveBeenCalledAfter: (mock: MockInstance, failIfNoFirstInvocation?: boolean) => R

  /**
   * Checks that a promise resolves successfully at least once.
   *
   * @example
   * await expect(promise).toHaveResolved();
   */
  toHaveResolved: () => R

  /**
   * Checks that a promise resolves to a specific value.
   *
   * @example
   * await expect(promise).toHaveResolvedWith('success');
   */
  toHaveResolvedWith: <E>(value: E) => R

  /**
   * Ensures a promise resolves a specific number of times.
   *
   * @example
   * expect(mockAsyncFunc).toHaveResolvedTimes(3);
   */
  toHaveResolvedTimes: (times: number) => R

  /**
   * Asserts that the last resolved value of a promise matches an expected value.
   *
   * @example
   * await expect(mockAsyncFunc).toHaveLastResolvedWith('finalResult');
   */
  toHaveLastResolvedWith: <E>(value: E) => R

  /**
   * Ensures a specific value was returned by a promise on the nth resolution.
   *
   * @example
   * await expect(mockAsyncFunc).toHaveNthResolvedWith(2, 'secondResult');
   */
  toHaveNthResolvedWith: <E>(nthCall: number, value: E) => R

  /**
   * Verifies that a promise resolves.
   *
   * @example
   * await expect(someAsyncFunc).resolves.toBe(42);
   */
  resolves: PromisifyAssertion<T>

  /**
   * Verifies that a promise rejects.
   *
   * @example
   * await expect(someAsyncFunc).rejects.toThrow('error');
   */
  rejects: PromisifyAssertion<T>
}

declare global {
  // support augmenting jest.Matchers by other libraries
  // eslint-disable-next-line ts/no-namespace
  namespace jest {
    // eslint-disable-next-line unused-imports/no-unused-vars, ts/no-empty-object-type
    interface Matchers<R, T = {}> {}
  }
}

export {}
