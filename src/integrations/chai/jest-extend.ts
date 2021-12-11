import chai, { util } from 'chai'

import { MatcherState } from 'expect'
import { MatchersObject, SyncExpectationResult } from 'expect/build/types'

import * as expectUtils from 'expect/build/utils'
import * as matcherUtils from 'jest-matcher-utils'
import { ChaiPlugin } from './types'

const isAsyncFunction = (fn: unknown) =>
  typeof fn === 'function' && (fn as any)[Symbol.toStringTag] === 'AsyncFunction'

const getMatcherState = (assertion: Chai.AssertionStatic & Chai.Assertion) => {
  const actual = assertion._obj
  const isNot = util.flag(assertion, 'negate') as boolean
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

function JestExtendPlugin(expects: MatchersObject): ChaiPlugin {
  return (c, utils) => {
    Object.entries(expects).forEach(([expectName, expectFn]) => {
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

      const expectWrapper = isAsyncFunction(expectFn) ? expectAsyncWrapper : expectSyncWrapper

      utils.addMethod(chai.Assertion.prototype, expectName, expectWrapper)
    })
  }
}

export function JestExtend(): ChaiPlugin {
  return (chai, utils) => {
    utils.addMethod(chai.expect, 'extend', (expects: MatchersObject) => {
      chai.use(JestExtendPlugin(expects))
    })
  }
}
