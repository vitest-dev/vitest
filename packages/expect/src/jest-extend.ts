import { util } from 'chai'
import type {
  ChaiPlugin,
  ExpectStatic,
  MatcherState,
  MatchersObject,
  SyncExpectationResult,
} from './types'
import { ASYMMETRIC_MATCHERS_OBJECT, JEST_MATCHERS_OBJECT } from './constants'
import { AsymmetricMatcher } from './jest-asymmetric-matchers'
import { getState } from './state'

import { diff, getMatcherUtils, stringify } from './jest-matcher-utils'

import {
  equals,
  iterableEquality,
  subsetEquality,
} from './jest-utils'
import { wrapSoft } from './utils'

function getMatcherState(assertion: Chai.AssertionStatic & Chai.Assertion, expect: ExpectStatic) {
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
    // TODO: implement via expect.addEqualityTesters
    customTesters: [],
    isNot,
    utils: jestUtils,
    promise,
    equals,
    // needed for built-in jest-snapshots, but we don't use it
    suppressedErrors: [],
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

function JestExtendPlugin(expect: ExpectStatic, matchers: MatchersObject): ChaiPlugin {
  return (c, utils) => {
    Object.entries(matchers).forEach(([expectAssertionName, expectAssertion]) => {
      function expectWrapper(this: Chai.AssertionStatic & Chai.Assertion, ...args: any[]) {
        const { state, isNot, obj } = getMatcherState(this, expect)

        // @ts-expect-error args wanting tuple
        const result = expectAssertion.call(state, obj, ...args)

        if (result && typeof result === 'object' && result instanceof Promise) {
          return result.then(({ pass, message, actual, expected }) => {
            if ((pass && isNot) || (!pass && !isNot))
              throw new JestExtendError(message(), actual, expected)
          })
        }

        const { pass, message, actual, expected } = result

        if ((pass && isNot) || (!pass && !isNot))
          throw new JestExtendError(message(), actual, expected)
      }

      const softWrapper = wrapSoft(utils, expectWrapper)
      utils.addMethod((globalThis as any)[JEST_MATCHERS_OBJECT].matchers, expectAssertionName, softWrapper)
      utils.addMethod(c.Assertion.prototype, expectAssertionName, softWrapper)

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
          return `${this.toString()}<${this.sample.map(String).join(', ')}>`
        }
      }

      const customMatcher = (...sample: [unknown, ...unknown[]]) => new CustomMatcher(false, ...sample)

      Object.defineProperty(expect, expectAssertionName, {
        configurable: true,
        enumerable: true,
        value: customMatcher,
        writable: true,
      })

      Object.defineProperty(expect.not, expectAssertionName, {
        configurable: true,
        enumerable: true,
        value: (...sample: [unknown, ...unknown[]]) => new CustomMatcher(true, ...sample),
        writable: true,
      })

      // keep track of asymmetric matchers on global so that it can be copied over to local context's `expect`.
      // note that the negated variant is automatically shared since it's assigned on the single `expect.not` object.
      Object.defineProperty(((globalThis as any)[ASYMMETRIC_MATCHERS_OBJECT]), expectAssertionName, {
        configurable: true,
        enumerable: true,
        value: customMatcher,
        writable: true,
      })
    })
  }
}

export const JestExtend: ChaiPlugin = (chai, utils) => {
  utils.addMethod(chai.expect, 'extend', (expect: ExpectStatic, expects: MatchersObject) => {
    chai.use(JestExtendPlugin(expect, expects))
  })
}
