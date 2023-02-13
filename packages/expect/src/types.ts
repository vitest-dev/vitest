import type { use as chaiUse } from 'chai'

/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { Formatter } from 'picocolors/types'
import type { diff, getMatcherUtils, stringify } from './jest-matcher-utils'

export type FirstFunctionArgument<T> = T extends (arg: infer A) => unknown ? A : never
export type ChaiPlugin = FirstFunctionArgument<typeof chaiUse>

export type Tester = (a: any, b: any) => boolean | undefined

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

export interface DiffOptions {
  aAnnotation?: string
  aColor?: Formatter
  aIndicator?: string
  bAnnotation?: string
  bColor?: Formatter
  bIndicator?: string
  changeColor?: Formatter
  changeLineTrailingSpaceColor?: Formatter
  commonColor?: Formatter
  commonIndicator?: string
  commonLineTrailingSpaceColor?: Formatter
  contextLines?: number
  emptyFirstOrLastLinePlaceholder?: string
  expand?: boolean
  includeChangeCounts?: boolean
  omitAnnotationLines?: boolean
  patchColor?: Formatter
  // pretty-format type
  compareKeys?: any
  showLegend?: boolean
}

export interface MatcherState {
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
