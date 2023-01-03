import c from 'picocolors'
import { stringify, unifiedDiff } from '@vitest/utils'
import type { DiffOptions, MatcherHintOptions } from './types'

export { stringify }

export const EXPECTED_COLOR = c.green
export const RECEIVED_COLOR = c.red
export const INVERTED_COLOR = c.inverse
export const BOLD_WEIGHT = c.bold
export const DIM_COLOR = c.dim

export function matcherHint(
  matcherName: string,
  received = 'received',
  expected = 'expected',
  options: MatcherHintOptions = {},
) {
  const {
    comment = '',
    isDirectExpectCall = false, // seems redundant with received === ''
    isNot = false,
    promise = '',
    secondArgument = '',
    expectedColor = EXPECTED_COLOR,
    receivedColor = RECEIVED_COLOR,
    secondArgumentColor = EXPECTED_COLOR,
  } = options
  let hint = ''
  let dimString = 'expect' // concatenate adjacent dim substrings

  if (!isDirectExpectCall && received !== '') {
    hint += DIM_COLOR(`${dimString}(`) + receivedColor(received)
    dimString = ')'
  }

  if (promise !== '') {
    hint += DIM_COLOR(`${dimString}.`) + promise
    dimString = ''
  }

  if (isNot) {
    hint += `${DIM_COLOR(`${dimString}.`)}not`
    dimString = ''
  }

  if (matcherName.includes('.')) {
    // Old format: for backward compatibility,
    // especially without promise or isNot options
    dimString += matcherName
  }
  else {
    // New format: omit period from matcherName arg
    hint += DIM_COLOR(`${dimString}.`) + matcherName
    dimString = ''
  }

  if (expected === '') {
    dimString += '()'
  }
  else {
    hint += DIM_COLOR(`${dimString}(`) + expectedColor(expected)
    if (secondArgument)
      hint += DIM_COLOR(', ') + secondArgumentColor(secondArgument)
    dimString = ')'
  }

  if (comment !== '')
    dimString += ` // ${comment}`

  if (dimString !== '')
    hint += DIM_COLOR(dimString)

  return hint
}

const SPACE_SYMBOL = '\u{00B7}' // middle dot

// Instead of inverse highlight which now implies a change,
// replace common spaces with middle dot at the end of any line.
const replaceTrailingSpaces = (text: string): string =>
  text.replace(/\s+$/gm, spaces => SPACE_SYMBOL.repeat(spaces.length))

export const printReceived = (object: unknown): string =>
  RECEIVED_COLOR(replaceTrailingSpaces(stringify(object)))
export const printExpected = (value: unknown): string =>
  EXPECTED_COLOR(replaceTrailingSpaces(stringify(value)))

// TODO: do something with options
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function diff(a: any, b: any, options?: DiffOptions) {
  return unifiedDiff(stringify(b), stringify(a))
}
