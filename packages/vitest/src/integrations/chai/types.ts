import type { use as chaiUse } from 'chai'

/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type * as jestMatcherUtils from './jest-matcher-utils'

export type FirstFunctionArgument<T> = T extends (arg: infer A) => unknown ? A : never
export type ChaiPlugin = FirstFunctionArgument<typeof chaiUse>

export type Tester = (a: any, b: any) => boolean | undefined

export type MatcherState = {
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
  expectedAssertionsNumberError?: Error | null
  isExpectingAssertions?: boolean
  isExpectingAssertionsError?: Error | null
  isNot: boolean
  promise: string
  suppressedErrors: Array<Error>
  testPath?: string
  utils: typeof jestMatcherUtils & {
    iterableEquality: Tester
    subsetEquality: Tester
  }
}

export type SyncExpectationResult = {
  pass: boolean
  message: () => string
}

export type AsyncExpectationResult = Promise<SyncExpectationResult>

export type ExpectationResult = SyncExpectationResult | AsyncExpectationResult

export type RawMatcherFn<T extends MatcherState = MatcherState> = {
  (this: T, received: any, expected: any, options?: any): ExpectationResult
}

export type ThrowingMatcherFn = (actual: any) => void
export type PromiseMatcherFn = (actual: any) => Promise<void>

export type MatchersObject<T extends MatcherState = MatcherState> = {
  [id: string]: RawMatcherFn<T>
}
