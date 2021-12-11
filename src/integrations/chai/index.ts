import chai from 'chai'

import { MatcherState } from 'expect'
import { MatchersObject, SyncExpectationResult } from 'expect/build/types'

import * as expectUtils from 'expect/build/utils'
import * as matcherUtils from 'jest-matcher-utils'

const isAsyncFunction = (fn: unknown) =>
  typeof fn === 'function' && (fn as any)[Symbol.toStringTag] === 'AsyncFunction'

chai.expect.extend = (expects: MatchersObject) => {
  chai.use((c, utils) => {
    Object.entries(expects).forEach(([expectName, expectFn]) => {
      const getMatcherState = (assertion: Chai.AssertionStatic & Chai.Assertion) => {
        const actual = assertion._obj
        const isNot = utils.flag(assertion, 'negate') as boolean
        const jestUtils = {
          ...matcherUtils,
          iterableEquality: expectUtils.iterableEquality,
          subsetEquality: expectUtils.subsetEquality,
        }

        // TODO add to ctx - { error, promise, equals, ...getState() }
        const matcherState: MatcherState = {
          isNot,
          utils: jestUtils,
          assertionCalls: 0,
          promise: '',
          equals: () => true,
          suppressedErrors: [],
        }

        return {
          state: matcherState,
          isNot,
          actual,
        }
      }

      function expectSyncWrapper(this: Chai.AssertionStatic & Chai.Assertion, ...args: any[]) {
        const { state, isNot, actual } = getMatcherState(this)

        // @ts-expect-error
        const { pass, message } = expectFn.call(state, actual, ...args) as SyncExpectationResult

        if ((pass && isNot) || (!pass && !isNot))
          c.expect.fail(message())
      }

      async function expectAsyncWrapper(this: Chai.AssertionStatic & Chai.Assertion, ...args: any[]) {
        const { state, isNot, actual } = getMatcherState(this)

        // @ts-expect-error
        const { pass, message } = await expectFn.call(state, actual, ...args) as SyncExpectationResult

        if ((pass && isNot) || (!pass && !isNot))
          c.expect.fail(message())
      }

      if (isAsyncFunction(expectFn))
        utils.addMethod(chai.Assertion.prototype, expectName, expectAsyncWrapper)

      else
        utils.addMethod(chai.Assertion.prototype, expectName, expectSyncWrapper)
    })
  })
}

export { assert, should, expect } from 'chai'

export { chai }
