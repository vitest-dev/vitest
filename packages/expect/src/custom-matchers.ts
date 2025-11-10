import type { MatchersObject } from './types'

// selectively ported from https://github.com/jest-community/jest-extended
export const customMatchers: MatchersObject = {
  toSatisfy(actual: unknown, expected: (actual: unknown) => boolean, message?: string) {
    const { printReceived, printExpected, matcherHint } = this.utils
    const pass = expected(actual)
    return {
      pass,
      message: () =>
        pass
          ? `\
${matcherHint('.not.toSatisfy', 'received', '')}

Expected value to not satisfy:
${message || printExpected(expected)}
Received:
${printReceived(actual)}`
          : `\
${matcherHint('.toSatisfy', 'received', '')}

Expected value to satisfy:
${message || printExpected(expected)}

Received:
${printReceived(actual)}`,
    }
  },

  toBeOneOf(actual: unknown, expected: Array<unknown> | Iterable<unknown>) {
    const { equals, customTesters } = this
    const { printReceived, printExpected, matcherHint } = this.utils

    const isArray = Array.isArray(expected)
    const isString = typeof expected === 'string'
    const isIterable = !isString
      && expected != null
      && typeof (expected as any)[Symbol.iterator] === 'function'

    if (!isArray && !isIterable) {
      throw new TypeError(
        `You must provide an array or iterable to ${matcherHint('.toBeOneOf')}, not '${typeof expected}'.`,
      )
    }

    const expectedArray = isArray ? expected : Array.from(expected as Iterable<unknown>)

    const pass = expectedArray.length === 0
      || expectedArray.some(item =>
        equals(item, actual, customTesters),
      )

    return {
      pass,
      message: () =>
        pass
          ? `\
  ${matcherHint('.not.toBeOneOf', 'received', '')}
  
  Expected value to not be one of:
  ${printExpected(expectedArray)}
  Received:
  ${printReceived(actual)}`
          : `\
  ${matcherHint('.toBeOneOf', 'received', '')}
  
  Expected value to be one of:
  ${printExpected(expectedArray)}
  
  Received:
  ${printReceived(actual)}`,
    }
  },
}
