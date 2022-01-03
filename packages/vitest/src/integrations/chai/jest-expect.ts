import type { EnhancedSpy } from '../jest-mock'
import { isMockFunction } from '../jest-mock'
import { addSerializer } from '../snapshot/port/plugins'
import type { ChaiPlugin, MatcherState } from './types'
import { arrayBufferEquality, equals as asymmetricEquals, hasAsymmetric, iterableEquality, sparseArrayEquality, typeEquality } from './jest-utils'

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
  function def(name: keyof Chai.Assertion | (keyof Chai.Assertion)[], fn: ((this: Chai.AssertionStatic & Chai.Assertion, ...args: any[]) => any)) {
    const addMethod = (n: keyof Chai.Assertion) => {
      utils.addMethod(chai.Assertion.prototype, n, fn)
    }

    if (Array.isArray(name))
      name.forEach(n => addMethod(n))

    else
      addMethod(name)
  }

  // we overrides the default `.equal`, keep original `.chaiEqual` in case need
  // @ts-expect-error
  const chaiEqual = chai.Assertion.prototype.equal
  def('chaiEqual', function(...args: any[]) {
    return chaiEqual.apply(this, args)
  })

  ;(['throw', 'throws', 'Throw'] as const).forEach((m) => {
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

  // overrides `.equal` and `.eql` to provide custom assertion for asymmetric equality
  utils.overwriteMethod(chai.Assertion.prototype, 'equal', (_super: any) => {
    return function(this: Chai.Assertion & Chai.AssertionStatic, ...args: any[]) {
      const expected = args[0]
      const actual = utils.flag(this, 'object')
      if (hasAsymmetric(expected)) {
        this.assert(
          asymmetricEquals(actual, expected, undefined, true),
          'not match with #{act}',
          'should not match with #{act}',
          actual,
          expected,
        )
      }
      else {
        _super.apply(this, args)
      }
    }
  })
  utils.overwriteMethod(chai.Assertion.prototype, 'eql', (_super: any) => {
    return function(this: Chai.Assertion & Chai.AssertionStatic, ...args: any[]) {
      const expected = args[0]
      const actual = utils.flag(this, 'object')
      if (hasAsymmetric(expected)) {
        this.assert(
          asymmetricEquals(actual, expected),
          'not match with #{exp}',
          'should not match with #{exp}',
          expected,
          actual,
        )
      }
      else {
        _super.apply(this, args)
      }
    }
  })

  def('toEqual', function(expected) {
    return this.eql(expected)
  })

  def('toStrictEqual', function(expected) {
    const obj = utils.flag(this, 'object')
    const equal = asymmetricEquals(
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
    return this.equal(expected)
  })
  def('toMatchObject', function(expected) {
    return this.containSubset(expected)
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
      return asymmetricEquals(item, expected)
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
  def('toBeGreaterThan', function(expected: number) {
    return this.to.greaterThan(expected)
  })
  def('toBeGreaterThanOrEqual', function(expected: number) {
    return this.to.greaterThanOrEqual(expected)
  })
  def('toBeLessThan', function(expected: number) {
    return this.to.lessThan(expected)
  })
  def('toBeLessThanOrEqual', function(expected: number) {
    return this.to.lessThanOrEqual(expected)
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
      `expected #{this} to be close to #{exp}, recieved difference is ${receivedDiff}, but expected ${expectedDiff}`,
      `expected #{this} to not be close to #{exp}, recieved difference is ${receivedDiff}, but expected ${expectedDiff}`,
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
    const pass = spy.mock.calls.some(callArg => asymmetricEquals(callArg, args, [iterableEquality]))
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
      asymmetricEquals(nthCall, args, [iterableEquality]),
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
      asymmetricEquals(lastCall, args, [iterableEquality]),
      `expected last "${spyName}" call to have been called with #{exp}`,
      `expected last "${spyName}" call to not have been called with #{exp}`,
      args,
      lastCall,
    )
  })
  def(['toThrow', 'toThrowError'], function(expected: string | RegExp) {
    return this.to.throw(expected)
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
    const pass = spy.mock.results.some(({ type, value: result }) => type === 'return' && asymmetricEquals(value, result))
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
    const pass = asymmetricEquals(lastResult, value)
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

    const nthCallReturn = asymmetricEquals(callResult, value)

    this.assert(
      nthCallReturn,
      `expected ${ordinalCall} "${spyName}" call to return #{exp}`,
      `expected ${ordinalCall} "${spyName}" call to not return #{exp}`,
      value,
      callResult,
    )
  })

  utils.addProperty(chai.Assertion.prototype, 'resolves', function(this: any) {
    utils.flag(this, 'promise', 'resolves')
    const obj = utils.flag(this, 'object')
    const proxy: any = new Proxy(this, {
      get: (target, key, reciever) => {
        const result = Reflect.get(target, key, reciever)

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

  utils.addProperty(chai.Assertion.prototype, 'rejects', function(this: any) {
    utils.flag(this, 'promise', 'rejects')
    const obj = utils.flag(this, 'object')
    const wrapper = typeof obj === 'function' ? obj() : obj // for jest compat
    const proxy: any = new Proxy(this, {
      get: (target, key, reciever) => {
        const result = Reflect.get(target, key, reciever)

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
