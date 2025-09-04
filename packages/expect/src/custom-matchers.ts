import type { MatchersObject } from './types'
import { isStandardSchema } from './jest-utils'

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

  toEqualSchema(actual: unknown, expected: unknown) {
    const { printReceived, printExpected, matcherHint, BOLD_WEIGHT } = this.utils

    if (!isStandardSchema(expected)) {
      throw new TypeError(
        `You must provide a Standard Schema to ${matcherHint('.toEqualSchema')}, not '${typeof expected}'.`,
      )
    }

    const validationResult = expected['~standard'].validate(actual)

    // Check if the result is a Promise (async validation)
    if (validationResult instanceof Promise) {
      throw new TypeError('Async schema validation is not supported in toEqualSchema()')
    }

    const pass = !validationResult.issues || validationResult.issues.length === 0
    const issues = validationResult.issues || []

    return {
      pass,
      message: () =>
        pass
          ? `\
${matcherHint('.not.toEqualSchema', 'received', 'schema')}

${BOLD_WEIGHT('Received:')}
${printReceived(actual)}

${BOLD_WEIGHT('Issues:')}
${JSON.stringify(issues, null, 2)}`
          : `\
${matcherHint('.toEqualSchema', 'received', 'schema')}

${BOLD_WEIGHT('Received:')}
${printReceived(actual)}

${BOLD_WEIGHT('Issues:')}
${JSON.stringify(issues, null, 2)}`,
    }
  },
}
