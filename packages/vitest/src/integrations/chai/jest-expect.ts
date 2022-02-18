import type { EnhancedSpy } from '../jest-mock'
import { isMockFunction } from '../jest-mock'
import { addSerializer } from '../snapshot/port/plugins'
import type { Constructable } from '../../types'
import { assertTypes } from '../../utils'
import type { ChaiPlugin, MatcherState } from './types'
import { arrayBufferEquality, iterableEquality, equals as jestEquals, sparseArrayEquality, subsetEquality, typeEquality } from './jest-utils'
import type { AsymmetricMatcher } from './jest-asymmetric-matchers'

const MATCHERS_OBJECT = Symbol.for('matchers-object')

if (!Object.prototype.hasOwnProperty.call(global, MATCHERS_OBJECT)) {
  const defaultState: Partial<MatcherState> = {
    assertionCalls: 0,
    isExpectingAssertions: false,
    isExpectingAssertionsError: null,
    expectedAssertionsNumber: null,
    expectedAssertionsNumberError: null,
  }
  Object.defineProperty(global, MATCHERS_OBJECT, {
    value: {
      state: defaultState,
    },
  })
}

export const getState = <State extends MatcherState = MatcherState>(): State =>
  (global as any)[MATCHERS_OBJECT].state

export const setState = <State extends MatcherState = MatcherState>(
  state: Partial<State>,
): void => {
  Object.assign((global as any)[MATCHERS_OBJECT].state, state)
}

// Jest Expect Compact
export const JestChaiExpect: ChaiPlugin = (chai, utils) => {
  function def(name: keyof Vi.Assertion | (keyof Vi.Assertion)[], fn: ((this: Chai.AssertionStatic & Vi.Assertion, ...args: any[]) => any)) {
    const addMethod = (n: keyof Vi.Assertion) => {
      utils.addMethod(chai.Assertion.prototype, n, fn)
    }

    if (Array.isArray(name))
      name.forEach(n => addMethod(n))

    else
      addMethod(name)
  }

  (['throw', 'throws', 'Throw'] as const).forEach((m) => {
    utils.overwriteMethod(chai.Assertion.prototype, m, (_super: any) => {
      return function(this: Chai.Assertion & Chai.AssertionStatic, ...args: any[]) {
        const promise = utils.flag(this, 'promise')
        const object = utils.flag(this, 'object')
        if (promise === 'rejects') {
          utils.flag(this, 'object', () => {
            throw object
          })
        }
        _super.apply(this, args)
      }
    })
  })

  def('toEqual', function(expected) {
    const actual = utils.flag(this, 'object')
    const equal = jestEquals(
      actual,
      expected,
      [iterableEquality],
    )

    return this.assert(
      equal,
      'expected #{this} to deeply equal #{exp}',
      'expected #{this} to not deeply equal #{exp}',
      expected,
      actual,
    )
  })

  def('toStrictEqual', function(expected) {
    const obj = utils.flag(this, 'object')
    const equal = jestEquals(
      obj,
      expected,
      [
        iterableEquality,
        typeEquality,
        sparseArrayEquality,
        arrayBufferEquality,
      ],
      true,
    )

    return this.assert(
      equal,
      'expected #{this} to strictly equal #{exp}',
      'expected #{this} to not strictly equal #{exp}',
      expected,
      obj,
    )
  })
  def('toBe', function(expected) {
    const actual = this._obj
    return this.assert(
      Object.is(actual, expected),
      'expected #{this} to be #{exp} // Object.is equality',
      'expected #{this} not to be #{exp} // Object.is equality',
      expected,
      actual,
    )
  })
  def('toMatchObject', function(expected) {
    const actual = this._obj
    return this.assert(
      jestEquals(actual, expected, [iterableEquality, subsetEquality]),
      'expected #{this} to match object #{exp}',
      'expected #{this} to not match object #{exp}',
      expected,
      actual,
    )
  })
  def('toMatch', function(expected: string | RegExp) {
    if (typeof expected === 'string')
      return this.include(expected)
    else
      return this.match(expected)
  })
  def('toContain', function(item) {
    return this.contain(item)
  })
  def('toContainEqual', function(expected) {
    const obj = utils.flag(this, 'object')
    const index = Array.from(obj).findIndex((item) => {
      return jestEquals(item, expected)
    })

    this.assert(
      index !== -1,
      'expected #{this} to deep equally contain #{exp}',
      'expected #{this} to not deep equally contain #{exp}',
      expected,
    )
  })
  def('toBeTruthy', function() {
    const obj = utils.flag(this, 'object')
    this.assert(
      Boolean(obj),
      'expected #{this} to be truthy',
      'expected #{this} to not be truthy',
      obj,
    )
  })
  def('toBeFalsy', function() {
    const obj = utils.flag(this, 'object')
    this.assert(
      !obj,
      'expected #{this} to be falsy',
      'expected #{this} to not be falsy',
      obj,
    )
  })
  def('toBeGreaterThan', function(expected: number | bigint) {
    const actual = this._obj
    assertTypes(actual, 'actual', ['number', 'bigint'])
    assertTypes(expected, 'expected', ['number', 'bigint'])
    return this.assert(
      actual > expected,
      `expected ${actual} to be greater than ${expected}`,
      `expected ${actual} to be not greater than ${expected}`,
      actual,
      expected,
    )
  })
  def('toBeGreaterThanOrEqual', function(expected: number | bigint) {
    const actual = this._obj
    assertTypes(actual, 'actual', ['number', 'bigint'])
    assertTypes(expected, 'expected', ['number', 'bigint'])
    return this.assert(
      actual >= expected,
      `expected ${actual} to be greater than or equal to ${expected}`,
      `expected ${actual} to be not greater than or equal to ${expected}`,
      actual,
      expected,
    )
  })
  def('toBeLessThan', function(expected: number | bigint) {
    const actual = this._obj
    assertTypes(actual, 'actual', ['number', 'bigint'])
    assertTypes(expected, 'expected', ['number', 'bigint'])
    return this.assert(
      actual < expected,
      `expected ${actual} to be less than ${expected}`,
      `expected ${actual} to be not less than ${expected}`,
      actual,
      expected,
    )
  })
  def('toBeLessThanOrEqual', function(expected: number | bigint) {
    const actual = this._obj
    assertTypes(actual, 'actual', ['number', 'bigint'])
    assertTypes(expected, 'expected', ['number', 'bigint'])
    return this.assert(
      actual <= expected,
      `expected ${actual} to be less than or equal to ${expected}`,
      `expected ${actual} to be not less than or equal to ${expected}`,
      actual,
      expected,
    )
  })
  def('toBeNaN', function() {
    return this.be.NaN
  })
  def('toBeUndefined', function() {
    return this.be.undefined
  })
  def('toBeNull', function() {
    return this.be.null
  })
  def('toBeDefined', function() {
    const negate = utils.flag(this, 'negate')
    utils.flag(this, 'negate', false)

    if (negate)
      return this.be.undefined

    return this.not.be.undefined
  })
  def('toBeTypeOf', function(expected: 'bigint' | 'boolean' | 'function' | 'number' | 'object' | 'string' | 'symbol' | 'undefined') {
    const actual = typeof this._obj
    const equal = expected === actual
    return this.assert(
      equal,
      'expected #{this} to be type of #{exp}',
      'expected #{this} not to be type of #{exp}',
      expected,
      actual,
    )
  })
  def('toBeInstanceOf', function(obj: any) {
    return this.instanceOf(obj)
  })
  def('toHaveLength', function(length: number) {
    return this.have.length(length)
  })
  // destructuring, because it checks `arguments` inside, and value is passing as `undefined`
  def('toHaveProperty', function(...args: [property: string, value?: any]) {
    return this.have.deep.nested.property(...args)
  })
  def('toBeCloseTo', function(received: number, precision = 2) {
    const expected = this._obj
    let pass = false
    let expectedDiff = 0
    let receivedDiff = 0

    if (received === Infinity && expected === Infinity) {
      pass = true
    }
    else if (received === -Infinity && expected === -Infinity) {
      pass = true
    }
    else {
      expectedDiff = Math.pow(10, -precision) / 2
      receivedDiff = Math.abs(expected - received)
      pass = receivedDiff < expectedDiff
    }
    return this.assert(
      pass,
      `expected #{this} to be close to #{exp}, received difference is ${receivedDiff}, but expected ${expectedDiff}`,
      `expected #{this} to not be close to #{exp}, received difference is ${receivedDiff}, but expected ${expectedDiff}`,
      received,
      expected,
    )
  })

  const assertIsMock = (assertion: any) => {
    if (!isMockFunction(assertion._obj))
      throw new TypeError(`${utils.inspect(assertion._obj)} is not a spy or a call to a spy!`)
  }
  const getSpy = (assertion: any) => {
    assertIsMock(assertion)
    return assertion._obj as EnhancedSpy
  }
  def(['toHaveBeenCalledTimes', 'toBeCalledTimes'], function(number: number) {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const callCount = spy.mock.calls.length
    return this.assert(
      callCount === number,
      `expected "${spyName}" to be called #{exp} times`,
      `expected "${spyName}" to not be called #{exp} times`,
      number,
      callCount,
    )
  })
  def('toHaveBeenCalledOnce', function() {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const callCount = spy.mock.calls.length
    return this.assert(
      callCount === 1,
      `expected "${spyName}" to be called once`,
      `expected "${spyName}" to not be called once`,
      1,
      callCount,
    )
  })
  def(['toHaveBeenCalled', 'toBeCalled'], function() {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const called = spy.mock.calls.length > 0
    return this.assert(
      called,
      `expected "${spyName}" to be called at least once`,
      `expected "${spyName}" to not be called at all`,
      true,
      called,
    )
  })
  def(['toHaveBeenCalledWith', 'toBeCalledWith'], function(...args) {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const pass = spy.mock.calls.some(callArg => jestEquals(callArg, args, [iterableEquality]))
    return this.assert(
      pass,
      `expected "${spyName}" to be called with arguments: #{exp}`,
      `expected "${spyName}" to not be called with arguments: #{exp}`,
      args,
      spy.mock.calls,
    )
  })
  const ordinalOf = (i: number) => {
    const j = i % 10
    const k = i % 100

    if (j === 1 && k !== 11)
      return `${i}st`

    if (j === 2 && k !== 12)
      return `${i}nd`

    if (j === 3 && k !== 13)
      return `${i}rd`

    return `${i}th`
  }
  def(['toHaveBeenNthCalledWith', 'nthCalledWith'], function(times: number, ...args: any[]) {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const nthCall = spy.mock.calls[times - 1]

    this.assert(
      jestEquals(nthCall, args, [iterableEquality]),
      `expected ${ordinalOf(times)} "${spyName}" call to have been called with #{exp}`,
      `expected ${ordinalOf(times)} "${spyName}" call to not have been called with #{exp}`,
      args,
      nthCall,
    )
  })
  def(['toHaveBeenLastCalledWith', 'lastCalledWith'], function(...args: any[]) {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const lastCall = spy.mock.calls[spy.calls.length - 1]

    this.assert(
      jestEquals(lastCall, args, [iterableEquality]),
      `expected last "${spyName}" call to have been called with #{exp}`,
      `expected last "${spyName}" call to not have been called with #{exp}`,
      args,
      lastCall,
    )
  })
  def(['toThrow', 'toThrowError'], function(expected?: string | Constructable | RegExp | Error) {
    const obj = this._obj
    const promise = utils.flag(this, 'promise')
    let thrown: any = null

    if (promise) {
      thrown = obj
    }
    else {
      try {
        obj()
      }
      catch (err) {
        thrown = err
      }
    }

    if (typeof expected === 'function') {
      const name = expected.name || expected.prototype.constructor.name
      return this.assert(
        thrown && thrown instanceof expected,
        `expected error to be instance of ${name}`,
        `expected error not to be instance of ${name}`,
        expected,
        thrown,
      )
    }

    if (expected && expected instanceof Error) {
      return this.assert(
        thrown && expected.message === thrown.message,
        `expected error to have message: ${expected.message}`,
        `expected error not to have message: ${expected.message}`,
        expected.message,
        thrown && thrown.message,
      )
    }

    if (expected && typeof (expected as any).asymmetricMatch === 'function') {
      const matcher = expected as any as AsymmetricMatcher<any>
      return this.assert(
        thrown && matcher.asymmetricMatch(thrown),
        'expected error to match asymmetric matcher',
        'expected error not to match asymmetric matcher',
        matcher.toString(),
        thrown,
      )
    }

    return this.to.throws(expected)
  })
  def(['toHaveReturned', 'toReturn'], function() {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const calledAndNotThrew = spy.mock.calls.length > 0 && !spy.mock.results.some(({ type }) => type === 'throw')
    this.assert(
      calledAndNotThrew,
      `expected "${spyName}" to be successfully called at least once`,
      `expected "${spyName}" to not be successfully called`,
      calledAndNotThrew,
      !calledAndNotThrew,
    )
  })
  def(['toHaveReturnedTimes', 'toReturnTimes'], function(times: number) {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const successfullReturns = spy.mock.results.reduce((success, { type }) => type === 'throw' ? success : ++success, 0)
    this.assert(
      successfullReturns === times,
      `expected "${spyName}" to be successfully called ${times} times`,
      `expected "${spyName}" to not be successfully called ${times} times`,
      `expected number of returns: ${times}`,
      `received number of returns: ${successfullReturns}`,
    )
  })
  def(['toHaveReturnedWith', 'toReturnWith'], function(value: any) {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const pass = spy.mock.results.some(({ type, value: result }) => type === 'return' && jestEquals(value, result))
    this.assert(
      pass,
      `expected "${spyName}" to be successfully called with #{exp}`,
      `expected "${spyName}" to not be successfully called with #{exp}`,
      value,
    )
  })
  def(['toHaveLastReturnedWith', 'lastReturnedWith'], function(value: any) {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const { value: lastResult } = spy.mock.results[spy.returns.length - 1]
    const pass = jestEquals(lastResult, value)
    this.assert(
      pass,
      `expected last "${spyName}" call to return #{exp}`,
      `expected last "${spyName}" call to not return #{exp}`,
      value,
      lastResult,
    )
  })
  def(['toHaveNthReturnedWith', 'nthReturnedWith'], function(nthCall: number, value: any) {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const isNot = utils.flag(this, 'negate') as boolean
    const { type: callType, value: callResult } = spy.mock.results[nthCall - 1]
    const ordinalCall = `${ordinalOf(nthCall)} call`

    if (!isNot && callType === 'throw')
      chai.assert.fail(`expected ${ordinalCall} to return #{exp}, but instead it threw an error`)

    const nthCallReturn = jestEquals(callResult, value)

    this.assert(
      nthCallReturn,
      `expected ${ordinalCall} "${spyName}" call to return #{exp}`,
      `expected ${ordinalCall} "${spyName}" call to not return #{exp}`,
      value,
      callResult,
    )
  })

  utils.addProperty(chai.Assertion.prototype, 'resolves', function __VITEST_RESOLVES__(this: any) {
    utils.flag(this, 'promise', 'resolves')
    utils.flag(this, 'error', new Error('resolves'))
    const obj = utils.flag(this, 'object')
    const proxy: any = new Proxy(this, {
      get: (target, key, receiver) => {
        const result = Reflect.get(target, key, receiver)

        if (typeof result !== 'function')
          return result instanceof chai.Assertion ? proxy : result

        return async(...args: any[]) => {
          return obj.then(
            (value: any) => {
              utils.flag(this, 'object', value)
              return result.call(this, ...args)
            },
            (err: any) => {
              throw new Error(`promise rejected "${err}" instead of resolving`)
            },
          )
        }
      },
    })

    return proxy
  })

  utils.addProperty(chai.Assertion.prototype, 'rejects', function __VITEST_REJECTS__(this: any) {
    utils.flag(this, 'promise', 'rejects')
    utils.flag(this, 'error', new Error('rejects'))
    const obj = utils.flag(this, 'object')
    const wrapper = typeof obj === 'function' ? obj() : obj // for jest compat
    const proxy: any = new Proxy(this, {
      get: (target, key, receiver) => {
        const result = Reflect.get(target, key, receiver)

        if (typeof result !== 'function')
          return result instanceof chai.Assertion ? proxy : result

        return async(...args: any[]) => {
          return wrapper.then(
            (value: any) => {
              throw new Error(`promise resolved "${value}" instead of rejecting`)
            },
            (err: any) => {
              utils.flag(this, 'object', err)
              return result.call(this, ...args)
            },
          )
        }
      },
    })

    return proxy
  })

  utils.addMethod(
    chai.expect,
    'assertions',
    function assertions(expected: number) {
      const error = new Error(`expected number of assertions to be ${expected}, but got ${getState().assertionCalls}`)
      if (Error.captureStackTrace)
        Error.captureStackTrace(error, assertions)

      setState({
        expectedAssertionsNumber: expected,
        expectedAssertionsNumberError: error,
      })
    },
  )

  utils.addMethod(
    chai.expect,
    'hasAssertions',
    function hasAssertions() {
      const error = new Error('expected any number of assertion, but got none')
      if (Error.captureStackTrace)
        Error.captureStackTrace(error, hasAssertions)

      setState({
        isExpectingAssertions: true,
        isExpectingAssertionsError: error,
      })
    },
  )

  utils.addMethod(
    chai.expect,
    'addSnapshotSerializer',
    addSerializer,
  )
}
