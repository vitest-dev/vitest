/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { Formatter } from 'picocolors/types'
import type { Constructable } from '@vitest/utils'
import type { diff, getMatcherUtils, stringify } from './jest-matcher-utils'

export type ChaiPlugin = Chai.ChaiPlugin

export type Tester = (a: any, b: any) => boolean | undefined

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
    strictCheck?: boolean,
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
}

export interface SyncExpectationResult {
  pass: boolean
  message: () => string
  actual?: any
  expected?: any
}

export type AsyncExpectationResult = Promise<SyncExpectationResult>

export type ExpectationResult = SyncExpectationResult | AsyncExpectationResult

export interface RawMatcherFn<T extends MatcherState = MatcherState> {
  (this: T, received: any, expected: any, options?: any): ExpectationResult
}

export type MatchersObject<T extends MatcherState = MatcherState> = Record<string, RawMatcherFn<T>>

export interface ExpectStatic extends Chai.ExpectStatic, AsymmetricMatchersContaining {
  <T>(actual: T, message?: string): Assertion<T>
  unreachable(message?: string): never
  soft<T>(actual: T, message?: string): Assertion<T>
  extend(expects: MatchersObject): void
  assertions(expected: number): void
  hasAssertions(): void
  anything(): any
  any(constructor: unknown): any
  getState(): MatcherState
  setState(state: Partial<MatcherState>): void
  not: AsymmetricMatchersContaining
}

export interface AsymmetricMatchersContaining {
  stringContaining(expected: string): any
  objectContaining<T = any>(expected: T): any
  arrayContaining<T = unknown>(expected: Array<T>): any
  stringMatching(expected: string | RegExp): any
  closeTo(expected: number, precision?: number): any
}

export interface JestAssertion<T = any> extends jest.Matchers<void, T> {
  // Jest compact
  toEqual<E>(expected: E): void
  toStrictEqual<E>(expected: E): void
  toBe<E>(expected: E): void
  toMatch(expected: string | RegExp): void
  toMatchObject<E extends {} | any[]>(expected: E): void
  toContain<E>(item: E): void
  toContainEqual<E>(item: E): void
  toBeTruthy(): void
  toBeFalsy(): void
  toBeGreaterThan(num: number | bigint): void
  toBeGreaterThanOrEqual(num: number | bigint): void
  toBeLessThan(num: number | bigint): void
  toBeLessThanOrEqual(num: number | bigint): void
  toBeNaN(): void
  toBeUndefined(): void
  toBeNull(): void
  toBeDefined(): void
  toBeInstanceOf<E>(expected: E): void
  toBeCalledTimes(times: number): void
  toHaveLength(length: number): void
  toHaveProperty<E>(property: string | (string | number)[], value?: E): void
  toBeCloseTo(number: number, numDigits?: number): void
  toHaveBeenCalledTimes(times: number): void
  toHaveBeenCalled(): void
  toBeCalled(): void
  toHaveBeenCalledWith<E extends any[]>(...args: E): void
  toBeCalledWith<E extends any[]>(...args: E): void
  toHaveBeenNthCalledWith<E extends any[]>(n: number, ...args: E): void
  nthCalledWith<E extends any[]>(nthCall: number, ...args: E): void
  toHaveBeenLastCalledWith<E extends any[]>(...args: E): void
  lastCalledWith<E extends any[]>(...args: E): void
  toThrow(expected?: string | Constructable | RegExp | Error): void
  toThrowError(expected?: string | Constructable | RegExp | Error): void
  toReturn(): void
  toHaveReturned(): void
  toReturnTimes(times: number): void
  toHaveReturnedTimes(times: number): void
  toReturnWith<E>(value: E): void
  toHaveReturnedWith<E>(value: E): void
  toHaveLastReturnedWith<E>(value: E): void
  lastReturnedWith<E>(value: E): void
  toHaveNthReturnedWith<E>(nthCall: number, value: E): void
  nthReturnedWith<E>(nthCall: number, value: E): void
}

type VitestAssertion<A, T> = {
  [K in keyof A]: A[K] extends Chai.Assertion
    ? Assertion<T>
    : A[K] extends (...args: any[]) => any
      ? A[K] // not converting function since they may contain overload
      : VitestAssertion<A[K], T>
} & ((type: string, message?: string) => Assertion)

type Promisify<O> = {
  [K in keyof O]: O[K] extends (...args: infer A) => infer R
    ? O extends R
      ? Promisify<O[K]>
      : (...args: A) => Promise<R>
    : O[K]
}

export interface Assertion<T = any> extends VitestAssertion<Chai.Assertion, T>, JestAssertion<T> {
  toBeTypeOf(expected: 'bigint' | 'boolean' | 'function' | 'number' | 'object' | 'string' | 'symbol' | 'undefined'): void
  toHaveBeenCalledOnce(): void
  toSatisfy<E>(matcher: (value: E) => boolean, message?: string): void

  resolves: Promisify<Assertion<T>>
  rejects: Promisify<Assertion<T>>
}

declare global {
  // support augmenting jest.Matchers by other libraries
  // eslint-disable-next-line ts/no-namespace
  namespace jest {

    // eslint-disable-next-line unused-imports/no-unused-vars
    interface Matchers<R, T = {}> {}
  }
}

export {}
