import type {
  ChaiPlugin,
  ExpectStatic,
  MatchersObject,
  MatcherState,
  SyncExpectationResult,
} from './types'
import { use, util } from 'chai'
import { ASYMMETRIC_MATCHERS_OBJECT, JEST_MATCHERS_OBJECT } from './constants'
import { AsymmetricMatcher } from './jest-asymmetric-matchers'
import {
  diff,
  getCustomEqualityTesters,
  getMatcherUtils,
  stringify,
} from './jest-matcher-utils'

import { equals, iterableEquality, subsetEquality } from './jest-utils'

import { getState } from './state'
import { wrapAssertion } from './utils'

function getMatcherState(
  assertion: Chai.AssertionStatic & Chai.Assertion,
  expect: ExpectStatic,
) {
  const obj = assertion._obj
  const isNot = util.flag(assertion, 'negate') as boolean
  const promise = util.flag(assertion, 'promise') || ''
  const jestUtils = {
    ...getMatcherUtils(),
    diff,
    stringify,
    iterableEquality,
    subsetEquality,
  }

  const matcherState: MatcherState = {
    ...getState(expect),
    customTesters: getCustomEqualityTesters(),
    isNot,
    utils: jestUtils,
    promise,
    equals,
    // needed for built-in jest-snapshots, but we don't use it
    suppressedErrors: [],
    soft: util.flag(assertion, 'soft') as boolean | undefined,
    poll: util.flag(assertion, 'poll') as boolean | undefined,
  }

  return {
    state: matcherState,
    isNot,
    obj,
  }
}

class JestExtendError extends Error {
  constructor(message: string, public actual?: any, public expected?: any) {
    super(message)
  }
}

function JestExtendPlugin(
  c: Chai.ChaiStatic,
  expect: ExpectStatic,
  matchers: MatchersObject,
): ChaiPlugin {
  return (_, utils) => {
    Object.entries(matchers).forEach(
      ([expectAssertionName, expectAssertion]) => {
        function expectWrapper(
          this: Chai.AssertionStatic & Chai.Assertion,
          ...args: any[]
        ) {
          const { state, isNot, obj } = getMatcherState(this, expect)

          const result = expectAssertion.call(state, obj, ...args)

          if (
            result
            && typeof result === 'object'
            && result instanceof Promise
          ) {
            return result.then(({ pass, message, actual, expected }) => {
              if ((pass && isNot) || (!pass && !isNot)) {
                throw new JestExtendError(message(), actual, expected)
              }
            })
          }

          const { pass, message, actual, expected } = result

          if ((pass && isNot) || (!pass && !isNot)) {
            throw new JestExtendError(message(), actual, expected)
          }
        }

        const softWrapper = wrapAssertion(utils, expectAssertionName, expectWrapper)
        utils.addMethod(
          (globalThis as any)[JEST_MATCHERS_OBJECT].matchers,
          expectAssertionName,
          softWrapper,
        )
        utils.addMethod(
          c.Assertion.prototype,
          expectAssertionName,
          softWrapper,
        )

        class CustomMatcher extends AsymmetricMatcher<[unknown, ...unknown[]]> {
          constructor(inverse = false, ...sample: [unknown, ...unknown[]]) {
            super(sample, inverse)
          }

          asymmetricMatch(other: unknown) {
            const { pass } = expectAssertion.call(
              this.getMatcherContext(expect),
              other,
              ...this.sample,
            ) as SyncExpectationResult

            return this.inverse ? !pass : pass
          }

          toString() {
            return `${this.inverse ? 'not.' : ''}${expectAssertionName}`
          }

          getExpectedType() {
            return 'any'
          }

          toAsymmetricMatcher() {
            return `${this.toString()}<${this.sample.map(item => stringify(item)).join(', ')}>`
          }
        }

        const customMatcher = (...sample: [unknown, ...unknown[]]) =>
          new CustomMatcher(false, ...sample)

        Object.defineProperty(expect, expectAssertionName, {
          configurable: true,
          enumerable: true,
          value: customMatcher,
          writable: true,
        })

        Object.defineProperty(expect.not, expectAssertionName, {
          configurable: true,
          enumerable: true,
          value: (...sample: [unknown, ...unknown[]]) =>
            new CustomMatcher(true, ...sample),
          writable: true,
        })

        // keep track of asymmetric matchers on global so that it can be copied over to local context's `expect`.
        // note that the negated variant is automatically shared since it's assigned on the single `expect.not` object.
        Object.defineProperty(
          (globalThis as any)[ASYMMETRIC_MATCHERS_OBJECT],
          expectAssertionName,
          {
            configurable: true,
            enumerable: true,
            value: customMatcher,
            writable: true,
          },
        )
      },
    )
  }
}

export const JestExtend: ChaiPlugin = (chai, utils) => {
  utils.addMethod(
    chai.expect,
    'extend',
    (expect: ExpectStatic, expects: MatchersObject) => {
      use(JestExtendPlugin(chai, expect, expects))
    },
  )
}
