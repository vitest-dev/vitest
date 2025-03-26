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

  toBeOneOf(actual: unknown, expected: Array<unknown>) {
    const { equals, customTesters } = this
    const { printReceived, printExpected, matcherHint } = this.utils

    if (!Array.isArray(expected)) {
      throw new TypeError(
        `You must provide an array to ${matcherHint('.toBeOneOf')}, not '${typeof expected}'.`,
      )
    }

    const pass = expected.length === 0
      || expected.some(item =>
        equals(item, actual, customTesters),
      )

    return {
      pass,
      message: () =>
        pass
          ? `\
${matcherHint('.not.toBeOneOf', 'received', '')}

Expected value to not be one of:
${printExpected(expected)}
Received:
${printReceived(actual)}`
          : `\
${matcherHint('.toBeOneOf', 'received', '')}

Expected value to be one of:
${printExpected(expected)}

Received:
${printReceived(actual)}`,
    }
  },
}
