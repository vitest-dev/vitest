import { util } from 'chai'
import type {
  ChaiPlugin,
  MatcherState,
  MatchersObject,
  SyncExpectationResult,
} from '../../types/chai'
import { AsymmetricMatcher } from './jest-asymmetric-matchers'
import { getState } from './jest-expect'

import * as matcherUtils from './jest-matcher-utils'

import {
  equals,
  iterableEquality,
  subsetEquality,
} from './jest-utils'

const isAsyncFunction = (fn: unknown) =>
  typeof fn === 'function' && (fn as any)[Symbol.toStringTag] === 'AsyncFunction'

const getMatcherState = (assertion: Chai.AssertionStatic & Chai.Assertion) => {
  const obj = assertion._obj
  const isNot = util.flag(assertion, 'negate') as boolean
  const promise = util.flag(assertion, 'promise') || ''
  const jestUtils = {
    ...matcherUtils,
    iterableEquality,
    subsetEquality,
  }

  const matcherState: MatcherState = {
    ...getState(),
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

function JestExtendPlugin(expect: Vi.ExpectStatic, matchers: MatchersObject): ChaiPlugin {
  return (c, utils) => {
    Object.entries(matchers).forEach(([expectAssertionName, expectAssertion]) => {
      function expectSyncWrapper(this: Chai.AssertionStatic & Chai.Assertion, ...args: any[]) {
        const { state, isNot, obj } = getMatcherState(this)

        // @ts-expect-error args wanting tuple
        const { pass, message, actual, expected } = expectAssertion.call(state, obj, ...args) as SyncExpectationResult

        if ((pass && isNot) || (!pass && !isNot))
          throw new JestExtendError(message(), actual, expected)
      }

      async function expectAsyncWrapper(this: Chai.AssertionStatic & Chai.Assertion, ...args: any[]) {
        const { state, isNot, obj } = getMatcherState(this)

        // @ts-expect-error args wanting tuple
        const { pass, message, actual, expected } = await expectAssertion.call(state, obj, ...args) as SyncExpectationResult

        if ((pass && isNot) || (!pass && !isNot))
          throw new JestExtendError(message(), actual, expected)
      }

      const expectAssertionWrapper = isAsyncFunction(expectAssertion) ? expectAsyncWrapper : expectSyncWrapper

      utils.addMethod(c.Assertion.prototype, expectAssertionName, expectAssertionWrapper)

      class CustomMatcher extends AsymmetricMatcher<[unknown, ...unknown[]]> {
        constructor(inverse = false, ...sample: [unknown, ...unknown[]]) {
          super(sample, inverse)
        }

        asymmetricMatch(other: unknown) {
          const { pass } = expectAssertion.call(
            this.getMatcherContext(),
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

      Object.defineProperty(expect, expectAssertionName, {
        configurable: true,
        enumerable: true,
        value: (...sample: [unknown, ...unknown[]]) => new CustomMatcher(false, ...sample),
        writable: true,
      })

      Object.defineProperty(expect.not, expectAssertionName, {
        configurable: true,
        enumerable: true,
        value: (...sample: [unknown, ...unknown[]]) => new CustomMatcher(true, ...sample),
        writable: true,
      })
    })
  }
}

export const JestExtend: ChaiPlugin = (chai, utils) => {
  utils.addMethod(chai.expect, 'extend', (expect: Vi.ExpectStatic, expects: MatchersObject) => {
    chai.use(JestExtendPlugin(expect, expects))
  })
}
