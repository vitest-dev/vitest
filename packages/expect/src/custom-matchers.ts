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
}
