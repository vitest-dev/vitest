/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// This is a fork of Jest's jest-diff package, but it doesn't depend on Node environment (like chalk).

import type { PrettyFormatOptions } from '@vitest/pretty-format'
import {
  format as prettyFormat,
  plugins as prettyFormatPlugins,
} from '@vitest/pretty-format'
import c from 'tinyrainbow'
import { stringify } from '../display'
import { deepClone, getOwnProperties, getType as getSimpleType } from '../helpers'
import { getType } from './getType'
import { DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT, Diff } from './cleanupSemantic'
import { NO_DIFF_MESSAGE, SIMILAR_MESSAGE } from './constants'
import { diffLinesRaw, diffLinesUnified, diffLinesUnified2 } from './diffLines'
import { normalizeDiffOptions } from './normalizeDiffOptions'
import { diffStringsRaw, diffStringsUnified } from './printDiffs'
import type { DiffOptions } from './types'

export type { DiffOptions, DiffOptionsColor } from './types'

export { diffLinesRaw, diffLinesUnified, diffLinesUnified2 }
export { diffStringsRaw, diffStringsUnified }
export { DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT, Diff }

function getCommonMessage(message: string, options?: DiffOptions) {
  const { commonColor } = normalizeDiffOptions(options)
  return commonColor(message)
}

const {
  AsymmetricMatcher,
  DOMCollection,
  DOMElement,
  Immutable,
  ReactElement,
  ReactTestComponent,
} = prettyFormatPlugins

const PLUGINS = [
  ReactTestComponent,
  ReactElement,
  DOMElement,
  DOMCollection,
  Immutable,
  AsymmetricMatcher,
]
const FORMAT_OPTIONS = {
  plugins: PLUGINS,
  printBasicPrototype: true
}
const FALLBACK_FORMAT_OPTIONS = {
  callToJSON: false,
  maxDepth: 10,
  plugins: PLUGINS,
}

// Generate a string that will highlight the difference between two values
// with green and red. (similar to how github does code diffing)

/**
 * @param a Expected value
 * @param b Received value
 * @param options Diff options
 * @returns {string | null} a string diff
 */
export function diff(a: any, b: any, options?: DiffOptions): string | undefined {
  if (Object.is(a, b)) {
    return ''
  }

  const aType = getType(a)
  let expectedType = aType
  let omitDifference = false
  if (aType === 'object' && typeof a.asymmetricMatch === 'function') {
    if (a.$$typeof !== Symbol.for('jest.asymmetricMatcher')) {
      // Do not know expected type of user-defined asymmetric matcher.
      return undefined
    }
    if (typeof a.getExpectedType !== 'function') {
      // For example, expect.anything() matches either null or undefined
      return undefined
    }
    expectedType = a.getExpectedType()
    // Primitive types boolean and number omit difference below.
    // For example, omit difference for expect.stringMatching(regexp)
    omitDifference = expectedType === 'string'
  }

  if (expectedType !== getType(b)) {
    const { aAnnotation, aColor, aIndicator, bAnnotation, bColor, bIndicator }
      = normalizeDiffOptions(options)
    const formatOptions = getFormatOptions(FALLBACK_FORMAT_OPTIONS, options)
    const aDisplay = prettyFormat(a, formatOptions)
    const bDisplay = prettyFormat(b, formatOptions)
    const aDiff = `${aColor(`${aIndicator} ${aAnnotation}:`)} \n${aDisplay}`
    const bDiff = `${bColor(`${bIndicator} ${bAnnotation}:`)} \n${bDisplay}`
    return `${aDiff}\n\n${bDiff}`
  }

  if (omitDifference) {
    return undefined
  }

  switch (aType) {
    case 'string':
      return diffLinesUnified(a.split('\n'), b.split('\n'), options)
    case 'boolean':
    case 'number':
      return comparePrimitive(a, b, options)
    case 'map':
      return compareObjects(sortMap(a), sortMap(b), options)
    case 'set':
      return compareObjects(sortSet(a), sortSet(b), options)
    default:
      return compareObjects(a, b, options)
  }
}

function comparePrimitive(
  a: number | boolean,
  b: number | boolean,
  options?: DiffOptions,
) {
  const aFormat = prettyFormat(a, FORMAT_OPTIONS)
  const bFormat = prettyFormat(b, FORMAT_OPTIONS)
  return aFormat === bFormat
    ? ''
    : diffLinesUnified(aFormat.split('\n'), bFormat.split('\n'), options)
}

function sortMap(map: Map<unknown, unknown>) {
  return new Map(Array.from(map.entries()).sort())
}

function sortSet(set: Set<unknown>) {
  return new Set(Array.from(set.values()).sort())
}

function compareObjects(
  a: Record<string, any>,
  b: Record<string, any>,
  options?: DiffOptions,
) {
  let difference
  let hasThrown = false

  try {
    const formatOptions = getFormatOptions(FORMAT_OPTIONS, options)
    difference = getObjectsDifference(a, b, formatOptions, options)
  }
  catch {
    hasThrown = true
  }

  const noDiffMessage = getCommonMessage(NO_DIFF_MESSAGE, options)
  // If the comparison yields no results, compare again but this time
  // without calling `toJSON`. It's also possible that toJSON might throw.
  if (difference === undefined || difference === noDiffMessage) {
    const formatOptions = getFormatOptions(FALLBACK_FORMAT_OPTIONS, options)
    difference = getObjectsDifference(a, b, formatOptions, options)

    if (difference !== noDiffMessage && !hasThrown) {
      difference = `${getCommonMessage(
        SIMILAR_MESSAGE,
        options,
      )}\n\n${difference}`
    }
  }

  return difference
}

function getFormatOptions(
  formatOptions: PrettyFormatOptions,
  options?: DiffOptions,
): PrettyFormatOptions {
  const { compareKeys, printBasicPrototype } = normalizeDiffOptions(options)

  return {
    ...formatOptions,
    compareKeys,
    printBasicPrototype
  }
}

function getObjectsDifference(
  a: Record<string, any>,
  b: Record<string, any>,
  formatOptions: PrettyFormatOptions,
  options?: DiffOptions,
): string {
  const formatOptionsZeroIndent = { ...formatOptions, indent: 0 }
  const aCompare = prettyFormat(a, formatOptionsZeroIndent)
  const bCompare = prettyFormat(b, formatOptionsZeroIndent)

  if (aCompare === bCompare) {
    return getCommonMessage(NO_DIFF_MESSAGE, options)
  }
  else {
    const aDisplay = prettyFormat(a, formatOptions)
    const bDisplay = prettyFormat(b, formatOptions)

    return diffLinesUnified2(
      aDisplay.split('\n'),
      bDisplay.split('\n'),
      aCompare.split('\n'),
      bCompare.split('\n'),
      options,
    )
  }
}

const MAX_DIFF_STRING_LENGTH = 20_000

function isAsymmetricMatcher(data: any) {
  const type = getSimpleType(data)
  return type === 'Object' && typeof data.asymmetricMatch === 'function'
}

function isReplaceable(obj1: any, obj2: any) {
  const obj1Type = getSimpleType(obj1)
  const obj2Type = getSimpleType(obj2)
  return (
    obj1Type === obj2Type && (obj1Type === 'Object' || obj1Type === 'Array')
  )
}

export function printDiffOrStringify(
  expected: unknown,
  received: unknown,
  options?: DiffOptions,
): string | undefined {
  const { aAnnotation, bAnnotation } = normalizeDiffOptions(options)

  if (
    typeof expected === 'string'
    && typeof received === 'string'
    && expected.length > 0
    && received.length > 0
    && expected.length <= MAX_DIFF_STRING_LENGTH
    && received.length <= MAX_DIFF_STRING_LENGTH
    && expected !== received
  ) {
    if (expected.includes('\n') || received.includes('\n')) {
      return diffStringsUnified(received, expected, options)
    }

    const [diffs] = diffStringsRaw(received, expected, true)
    const hasCommonDiff = diffs.some(diff => diff[0] === DIFF_EQUAL)

    const printLabel = getLabelPrinter(aAnnotation, bAnnotation)
    const expectedLine
      = printLabel(aAnnotation)
      + printExpected(
        getCommonAndChangedSubstrings(diffs, DIFF_DELETE, hasCommonDiff),
      )
    const receivedLine
      = printLabel(bAnnotation)
      + printReceived(
        getCommonAndChangedSubstrings(diffs, DIFF_INSERT, hasCommonDiff),
      )

    return `${expectedLine}\n${receivedLine}`
  }

  // if (isLineDiffable(expected, received)) {
  const clonedExpected = deepClone(expected, { forceWritable: true })
  const clonedReceived = deepClone(received, { forceWritable: true })
  const { replacedExpected, replacedActual } = replaceAsymmetricMatcher(clonedExpected, clonedReceived)
  const difference = diff(replacedExpected, replacedActual, options)

  return difference
  // }

  // const printLabel = getLabelPrinter(aAnnotation, bAnnotation)
  // const expectedLine = printLabel(aAnnotation) + printExpected(expected)
  // const receivedLine
  //   = printLabel(bAnnotation)
  //   + (stringify(expected) === stringify(received)
  //     ? 'serializes to the same string'
  //     : printReceived(received))

  // return `${expectedLine}\n${receivedLine}`
}

export function replaceAsymmetricMatcher(
  actual: any,
  expected: any,
  actualReplaced: WeakSet<WeakKey> = new WeakSet(),
  expectedReplaced: WeakSet<WeakKey> = new WeakSet(),
): {
    replacedActual: any
    replacedExpected: any
  } {
  if (!isReplaceable(actual, expected)) {
    return { replacedActual: actual, replacedExpected: expected }
  }
  if (actualReplaced.has(actual) || expectedReplaced.has(expected)) {
    return { replacedActual: actual, replacedExpected: expected }
  }
  actualReplaced.add(actual)
  expectedReplaced.add(expected)
  getOwnProperties(expected).forEach((key) => {
    const expectedValue = expected[key]
    const actualValue = actual[key]
    if (isAsymmetricMatcher(expectedValue)) {
      if (expectedValue.asymmetricMatch(actualValue)) {
        actual[key] = expectedValue
      }
    }
    else if (isAsymmetricMatcher(actualValue)) {
      if (actualValue.asymmetricMatch(expectedValue)) {
        expected[key] = actualValue
      }
    }
    else if (isReplaceable(actualValue, expectedValue)) {
      const replaced = replaceAsymmetricMatcher(
        actualValue,
        expectedValue,
        actualReplaced,
        expectedReplaced,
      )
      actual[key] = replaced.replacedActual
      expected[key] = replaced.replacedExpected
    }
  })
  return {
    replacedActual: actual,
    replacedExpected: expected,
  }
}

type PrintLabel = (string: string) => string
export function getLabelPrinter(...strings: Array<string>): PrintLabel {
  const maxLength = strings.reduce(
    (max, string) => (string.length > max ? string.length : max),
    0,
  )
  return (string: string): string =>
    `${string}: ${' '.repeat(maxLength - string.length)}`
}

const SPACE_SYMBOL = '\u{00B7}' // middle dot
function replaceTrailingSpaces(text: string): string {
  return text.replace(/\s+$/gm, spaces => SPACE_SYMBOL.repeat(spaces.length))
}

function printReceived(object: unknown): string {
  return c.red(replaceTrailingSpaces(stringify(object)))
}
function printExpected(value: unknown): string {
  return c.green(replaceTrailingSpaces(stringify(value)))
}

function getCommonAndChangedSubstrings(diffs: Array<Diff>, op: number, hasCommonDiff: boolean): string {
  return diffs.reduce(
    (reduced: string, diff: Diff): string =>
      reduced
      + (diff[0] === DIFF_EQUAL
        ? diff[1]
        : diff[0] === op
          ? hasCommonDiff
            ? c.inverse(diff[1])
            : diff[1]
          : ''),
    '',
  )
}
