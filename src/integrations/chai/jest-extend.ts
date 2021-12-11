import chai, { util } from 'chai'

import * as matcherUtils from 'jest-matcher-utils'

import {
  iterableEquality,
  subsetEquality,
  equals,
} from './jest-utils'
import {
  ChaiPlugin,
  MatcherState,
  MatchersObject,
  SyncExpectationResult,
} from './types'

const isAsyncFunction = (fn: unknown) =>
  typeof fn === 'function' && (fn as any)[Symbol.toStringTag] === 'AsyncFunction'

const getMatcherState = (assertion: Chai.AssertionStatic & Chai.Assertion) => {
  const actual = assertion._obj
  const isNot = util.flag(assertion, 'negate') as boolean
  const jestUtils = {
    ...matcherUtils,
    iterableEquality,
    subsetEquality,
  }

  // TODO add to ctx - { error, promise, equals, ...getState() }
  const matcherState: MatcherState = {
    isNot,
    utils: jestUtils,
    assertionCalls: 0,
    promise: '',
    equals,
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
    Object.entries(expects).forEach(([expectAssertionName, expectAssertion]) => {
      function expectSyncWrapper(this: Chai.AssertionStatic & Chai.Assertion, ...args: any[]) {
        const { state, isNot, actual } = getMatcherState(this)

        // @ts-expect-error
        const { pass, message } = expectAssertion.call(state, actual, ...args) as SyncExpectationResult

        if ((pass && isNot) || (!pass && !isNot))
          c.expect.fail(message())
      }

      async function expectAsyncWrapper(this: Chai.AssertionStatic & Chai.Assertion, ...args: any[]) {
        const { state, isNot, actual } = getMatcherState(this)

        // @ts-expect-error
        const { pass, message } = await expectAssertion.call(state, actual, ...args) as SyncExpectationResult

        if ((pass && isNot) || (!pass && !isNot))
          c.expect.fail(message())
      }

      const expectAssertionWrapper = isAsyncFunction(expectAssertion) ? expectAsyncWrapper : expectSyncWrapper

      utils.addMethod(chai.Assertion.prototype, expectAssertionName, expectAssertionWrapper)
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
