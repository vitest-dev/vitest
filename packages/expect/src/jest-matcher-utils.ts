import type { MatcherHintOptions, Tester } from './types'
import { getType, stringify } from '@vitest/utils'
import { diff, printDiffOrStringify } from '@vitest/utils/diff'
import c from 'tinyrainbow'
import { JEST_MATCHERS_OBJECT } from './constants'

export { diff } from '@vitest/utils/diff'
export { stringify }

const EXPECTED_COLOR = c.green
const RECEIVED_COLOR = c.red
const INVERTED_COLOR = c.inverse
const BOLD_WEIGHT = c.bold
const DIM_COLOR = c.dim

function matcherHint(
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
    if (secondArgument) {
      hint += DIM_COLOR(', ') + secondArgumentColor(secondArgument)
    }
    dimString = ')'
  }

  if (comment !== '') {
    dimString += ` // ${comment}`
  }

  if (dimString !== '') {
    hint += DIM_COLOR(dimString)
  }

  return hint
}

const SPACE_SYMBOL = '\u{00B7}' // middle dot

// Instead of inverse highlight which now implies a change,
// replace common spaces with middle dot at the end of any line.
function replaceTrailingSpaces(text: string): string {
  return text.replace(/\s+$/gm, spaces => SPACE_SYMBOL.repeat(spaces.length))
}

function printReceived(object: unknown): string {
  return RECEIVED_COLOR(replaceTrailingSpaces(stringify(object)))
}
function printExpected(value: unknown): string {
  return EXPECTED_COLOR(replaceTrailingSpaces(stringify(value)))
}

export function getMatcherUtils() {
  return {
    EXPECTED_COLOR,
    RECEIVED_COLOR,
    INVERTED_COLOR,
    BOLD_WEIGHT,
    DIM_COLOR,

    diff,
    matcherHint,
    printReceived,
    printExpected,
    printDiffOrStringify,
  }
}

export function addCustomEqualityTesters(newTesters: Array<Tester>): void {
  if (!Array.isArray(newTesters)) {
    throw new TypeError(
      `expect.customEqualityTesters: Must be set to an array of Testers. Was given "${getType(
        newTesters,
      )}"`,
    )
  }

  (globalThis as any)[JEST_MATCHERS_OBJECT].customEqualityTesters.push(
    ...newTesters,
  )
}

export function getCustomEqualityTesters(): Array<Tester> {
  return (globalThis as any)[JEST_MATCHERS_OBJECT].customEqualityTesters
}
