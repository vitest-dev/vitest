import { assertTypes, getColors } from '@vitest/utils'
import type { Constructable } from '@vitest/utils'
import type { MockInstance } from '@vitest/spy'
import { isMockFunction } from '@vitest/spy'
import type { Test } from '@vitest/runner'
import type { Assertion, ChaiPlugin } from './types'
import { arrayBufferEquality, generateToBeMessage, iterableEquality, equals as jestEquals, sparseArrayEquality, subsetEquality, typeEquality } from './jest-utils'
import type { AsymmetricMatcher } from './jest-asymmetric-matchers'
import { diff, stringify } from './jest-matcher-utils'
import { JEST_MATCHERS_OBJECT } from './constants'
import { recordAsyncExpect, wrapSoft } from './utils'

// polyfill globals because expect can be used in node environment
declare class Node {
  contains(item: unknown): boolean
}
declare class DOMTokenList {
  value: string
  contains(item: unknown): boolean
}

// Jest Expect Compact
export const JestChaiExpect: ChaiPlugin = (chai, utils) => {
  const { AssertionError } = chai
  const c = () => getColors()

  function def(name: keyof Assertion | (keyof Assertion)[], fn: ((this: Chai.AssertionStatic & Assertion, ...args: any[]) => any)) {
    const addMethod = (n: keyof Assertion) => {
      const softWrapper = wrapSoft(utils, fn)
      utils.addMethod(chai.Assertion.prototype, n, softWrapper)
      utils.addMethod((globalThis as any)[JEST_MATCHERS_OBJECT].matchers, n, softWrapper)
    }

    if (Array.isArray(name))
      name.forEach(n => addMethod(n))

    else
      addMethod(name)
  }

  (['throw', 'throws', 'Throw'] as const).forEach((m) => {
    utils.overwriteMethod(chai.Assertion.prototype, m, (_super: any) => {
      return function (this: Chai.Assertion & Chai.AssertionStatic, ...args: any[]) {
        const promise = utils.flag(this, 'promise')
        const object = utils.flag(this, 'object')
        const isNot = utils.flag(this, 'negate') as boolean
        if (promise === 'rejects') {
          utils.flag(this, 'object', () => {
            throw object
          })
        }
        // if it got here, it's already resolved
        // unless it tries to resolve to a function that should throw
        // called as '.resolves[.not].toThrow()`
        else if (promise === 'resolves' && typeof object !== 'function') {
          if (!isNot) {
            const message = utils.flag(this, 'message') || 'expected promise to throw an error, but it didn\'t'
            const error = {
              showDiff: false,
            }
            throw new AssertionError(message, error, utils.flag(this, 'ssfi'))
          }
          else {
            return
          }
        }
        _super.apply(this, args)
      }
    })
  })

  // @ts-expect-error @internal
  def('withTest', function (test: Test) {
    utils.flag(this, 'vitest-test', test)
    return this
  })

  def('toEqual', function (expected) {
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

  def('toStrictEqual', function (expected) {
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
  def('toBe', function (expected) {
    const actual = this._obj
    const pass = Object.is(actual, expected)

    let deepEqualityName = ''

    if (!pass) {
      const toStrictEqualPass = jestEquals(
        actual,
        expected,
        [
          iterableEquality,
          typeEquality,
          sparseArrayEquality,
          arrayBufferEquality,
        ],
        true,
      )

      if (toStrictEqualPass) {
        deepEqualityName = 'toStrictEqual'
      }
      else {
        const toEqualPass = jestEquals(
          actual,
          expected,
          [iterableEquality],
        )

        if (toEqualPass)
          deepEqualityName = 'toEqual'
      }
    }

    return this.assert(
      pass,
      generateToBeMessage(deepEqualityName),
      'expected #{this} not to be #{exp} // Object.is equality',
      expected,
      actual,
    )
  })
  def('toMatchObject', function (expected) {
    const actual = this._obj
    return this.assert(
      jestEquals(actual, expected, [iterableEquality, subsetEquality]),
      'expected #{this} to match object #{exp}',
      'expected #{this} to not match object #{exp}',
      expected,
      actual,
    )
  })
  def('toMatch', function (expected: string | RegExp) {
    if (typeof expected === 'string')
      return this.include(expected)
    else
      return this.match(expected)
  })
  def('toContain', function (item) {
    const actual = this._obj as Iterable<unknown> | string | Node | DOMTokenList

    if (typeof Node !== 'undefined' && actual instanceof Node) {
      if (!(item instanceof Node))
        throw new TypeError(`toContain() expected a DOM node as the argument, but got ${typeof item}`)

      return this.assert(
        actual.contains(item),
        'expected #{this} to contain element #{exp}',
        'expected #{this} not to contain element #{exp}',
        item,
        actual,
      )
    }

    if (typeof DOMTokenList !== 'undefined' && actual instanceof DOMTokenList) {
      assertTypes(item, 'class name', ['string'])
      const isNot = utils.flag(this, 'negate') as boolean
      const expectedClassList = isNot ? actual.value.replace(item, '').trim() : `${actual.value} ${item}`
      return this.assert(
        actual.contains(item),
        `expected "${actual.value}" to contain "${item}"`,
        `expected "${actual.value}" not to contain "${item}"`,
        expectedClassList,
        actual.value,
      )
    }
    // make "actual" indexable to have compatibility with jest
    if (actual != null && typeof actual !== 'string')
      utils.flag(this, 'object', Array.from(actual as Iterable<unknown>))
    return this.contain(item)
  })
  def('toContainEqual', function (expected) {
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
  def('toBeTruthy', function () {
    const obj = utils.flag(this, 'object')
    this.assert(
      Boolean(obj),
      'expected #{this} to be truthy',
      'expected #{this} to not be truthy',
      obj,
      false,
    )
  })
  def('toBeFalsy', function () {
    const obj = utils.flag(this, 'object')
    this.assert(
      !obj,
      'expected #{this} to be falsy',
      'expected #{this} to not be falsy',
      obj,
      false,
    )
  })
  def('toBeGreaterThan', function (expected: number | bigint) {
    const actual = this._obj as number | bigint
    assertTypes(actual, 'actual', ['number', 'bigint'])
    assertTypes(expected, 'expected', ['number', 'bigint'])
    return this.assert(
      actual > expected,
      `expected ${actual} to be greater than ${expected}`,
      `expected ${actual} to be not greater than ${expected}`,
      actual,
      expected,
      false,
    )
  })
  def('toBeGreaterThanOrEqual', function (expected: number | bigint) {
    const actual = this._obj as number | bigint
    assertTypes(actual, 'actual', ['number', 'bigint'])
    assertTypes(expected, 'expected', ['number', 'bigint'])
    return this.assert(
      actual >= expected,
      `expected ${actual} to be greater than or equal to ${expected}`,
      `expected ${actual} to be not greater than or equal to ${expected}`,
      actual,
      expected,
      false,
    )
  })
  def('toBeLessThan', function (expected: number | bigint) {
    const actual = this._obj as number | bigint
    assertTypes(actual, 'actual', ['number', 'bigint'])
    assertTypes(expected, 'expected', ['number', 'bigint'])
    return this.assert(
      actual < expected,
      `expected ${actual} to be less than ${expected}`,
      `expected ${actual} to be not less than ${expected}`,
      actual,
      expected,
      false,
    )
  })
  def('toBeLessThanOrEqual', function (expected: number | bigint) {
    const actual = this._obj as number | bigint
    assertTypes(actual, 'actual', ['number', 'bigint'])
    assertTypes(expected, 'expected', ['number', 'bigint'])
    return this.assert(
      actual <= expected,
      `expected ${actual} to be less than or equal to ${expected}`,
      `expected ${actual} to be not less than or equal to ${expected}`,
      actual,
      expected,
      false,
    )
  })
  def('toBeNaN', function () {
    return this.be.NaN
  })
  def('toBeUndefined', function () {
    return this.be.undefined
  })
  def('toBeNull', function () {
    return this.be.null
  })
  def('toBeDefined', function () {
    const negate = utils.flag(this, 'negate')
    utils.flag(this, 'negate', false)

    if (negate)
      return this.be.undefined

    return this.not.be.undefined
  })
  def('toBeTypeOf', function (expected: 'bigint' | 'boolean' | 'function' | 'number' | 'object' | 'string' | 'symbol' | 'undefined') {
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
  def('toBeInstanceOf', function (obj: any) {
    return this.instanceOf(obj)
  })
  def('toHaveLength', function (length: number) {
    return this.have.length(length)
  })
  // destructuring, because it checks `arguments` inside, and value is passing as `undefined`
  def('toHaveProperty', function (...args: [property: string | (string | number)[], value?: any]) {
    if (Array.isArray(args[0]))
      args[0] = args[0].map(key => String(key).replace(/([.[\]])/g, '\\$1')).join('.')

    const actual = this._obj as any
    const [propertyName, expected] = args
    const getValue = () => {
      const hasOwn = Object.prototype.hasOwnProperty.call(actual, propertyName)
      if (hasOwn)
        return { value: actual[propertyName], exists: true }
      return utils.getPathInfo(actual, propertyName)
    }
    const { value, exists } = getValue()
    const pass = exists && (args.length === 1 || jestEquals(expected, value))

    const valueString = args.length === 1 ? '' : ` with value ${utils.objDisplay(expected)}`

    return this.assert(
      pass,
      `expected #{this} to have property "${propertyName}"${valueString}`,
      `expected #{this} to not have property "${propertyName}"${valueString}`,
      expected,
      exists ? value : undefined,
    )
  })
  def('toBeCloseTo', function (received: number, precision = 2) {
    const expected = this._obj
    let pass = false
    let expectedDiff = 0
    let receivedDiff = 0

    if (received === Number.POSITIVE_INFINITY && expected === Number.POSITIVE_INFINITY) {
      pass = true
    }
    else if (received === Number.NEGATIVE_INFINITY && expected === Number.NEGATIVE_INFINITY) {
      pass = true
    }
    else {
      expectedDiff = 10 ** -precision / 2
      receivedDiff = Math.abs(expected - received)
      pass = receivedDiff < expectedDiff
    }
    return this.assert(
      pass,
      `expected #{this} to be close to #{exp}, received difference is ${receivedDiff}, but expected ${expectedDiff}`,
      `expected #{this} to not be close to #{exp}, received difference is ${receivedDiff}, but expected ${expectedDiff}`,
      received,
      expected,
      false,
    )
  })

  const assertIsMock = (assertion: any) => {
    if (!isMockFunction(assertion._obj))
      throw new TypeError(`${utils.inspect(assertion._obj)} is not a spy or a call to a spy!`)
  }
  const getSpy = (assertion: any) => {
    assertIsMock(assertion)
    return assertion._obj as MockInstance
  }
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
  const formatCalls = (spy: MockInstance, msg: string, actualCall?: any) => {
    if (spy.mock.calls) {
      msg += c().gray(`\n\nReceived: \n\n${spy.mock.calls.map((callArg, i) => {
        let methodCall = c().bold(`  ${ordinalOf(i + 1)} ${spy.getMockName()} call:\n\n`)
        if (actualCall)
          methodCall += diff(actualCall, callArg, { omitAnnotationLines: true })
        else
          methodCall += stringify(callArg).split('\n').map(line => `    ${line}`).join('\n')

        methodCall += '\n'
        return methodCall
      }).join('\n')}`)
    }
    msg += c().gray(`\n\nNumber of calls: ${c().bold(spy.mock.calls.length)}\n`)
    return msg
  }
  const formatReturns = (spy: MockInstance, msg: string, actualReturn?: any) => {
    msg += c().gray(`\n\nReceived: \n\n${spy.mock.results.map((callReturn, i) => {
      let methodCall = c().bold(`  ${ordinalOf(i + 1)} ${spy.getMockName()} call return:\n\n`)
      if (actualReturn)
        methodCall += diff(actualReturn, callReturn.value, { omitAnnotationLines: true })
      else
        methodCall += stringify(callReturn).split('\n').map(line => `    ${line}`).join('\n')

      methodCall += '\n'
      return methodCall
    }).join('\n')}`)
    msg += c().gray(`\n\nNumber of calls: ${c().bold(spy.mock.calls.length)}\n`)
    return msg
  }
  def(['toHaveBeenCalledTimes', 'toBeCalledTimes'], function (number: number) {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const callCount = spy.mock.calls.length
    return this.assert(
      callCount === number,
      `expected "${spyName}" to be called #{exp} times, but got ${callCount} times`,
      `expected "${spyName}" to not be called #{exp} times`,
      number,
      callCount,
      false,
    )
  })
  def('toHaveBeenCalledOnce', function () {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const callCount = spy.mock.calls.length
    return this.assert(
      callCount === 1,
      `expected "${spyName}" to be called once, but got ${callCount} times`,
      `expected "${spyName}" to not be called once`,
      1,
      callCount,
      false,
    )
  })
  def(['toHaveBeenCalled', 'toBeCalled'], function () {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const callCount = spy.mock.calls.length
    const called = callCount > 0
    const isNot = utils.flag(this, 'negate') as boolean
    let msg = utils.getMessage(
      this,
      [
        called,
        `expected "${spyName}" to be called at least once`,
        `expected "${spyName}" to not be called at all, but actually been called ${callCount} times`,
        true,
        called,
      ],
    )
    if (called && isNot)
      msg = formatCalls(spy, msg)

    if ((called && isNot) || (!called && !isNot))
      throw new AssertionError(msg)
  })
  def(['toHaveBeenCalledWith', 'toBeCalledWith'], function (...args) {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const pass = spy.mock.calls.some(callArg => jestEquals(callArg, args, [iterableEquality]))
    const isNot = utils.flag(this, 'negate') as boolean

    const msg = utils.getMessage(
      this,
      [
        pass,
        `expected "${spyName}" to be called with arguments: #{exp}`,
        `expected "${spyName}" to not be called with arguments: #{exp}`,
        args,
      ],
    )

    if ((pass && isNot) || (!pass && !isNot))
      throw new AssertionError(formatCalls(spy, msg, args))
  })
  def(['toHaveBeenNthCalledWith', 'nthCalledWith'], function (times: number, ...args: any[]) {
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
  def(['toHaveBeenLastCalledWith', 'lastCalledWith'], function (...args: any[]) {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]

    this.assert(
      jestEquals(lastCall, args, [iterableEquality]),
      `expected last "${spyName}" call to have been called with #{exp}`,
      `expected last "${spyName}" call to not have been called with #{exp}`,
      args,
      lastCall,
    )
  })
  def(['toThrow', 'toThrowError'], function (expected?: string | Constructable | RegExp | Error) {
    if (typeof expected === 'string' || typeof expected === 'undefined' || expected instanceof RegExp)
      return this.throws(expected)

    const obj = this._obj
    const promise = utils.flag(this, 'promise')
    const isNot = utils.flag(this, 'negate') as boolean
    let thrown: any = null

    if (promise === 'rejects') {
      thrown = obj
    }
    // if it got here, it's already resolved
    // unless it tries to resolve to a function that should throw
    // called as .resolves.toThrow(Error)
    else if (promise === 'resolves' && typeof obj !== 'function') {
      if (!isNot) {
        const message = utils.flag(this, 'message') || 'expected promise to throw an error, but it didn\'t'
        const error = {
          showDiff: false,
        }
        throw new AssertionError(message, error, utils.flag(this, 'ssfi'))
      }
      else {
        return
      }
    }
    else {
      let isThrow = false
      try {
        obj()
      }
      catch (err) {
        isThrow = true
        thrown = err
      }

      if (!isThrow && !isNot) {
        const message = utils.flag(this, 'message') || 'expected function to throw an error, but it didn\'t'
        const error = {
          showDiff: false,
        }
        throw new AssertionError(message, error, utils.flag(this, 'ssfi'))
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
        false,
      )
    }

    if (expected instanceof Error) {
      return this.assert(
        thrown && expected.message === thrown.message,
        `expected error to have message: ${expected.message}`,
        `expected error not to have message: ${expected.message}`,
        expected.message,
        thrown && thrown.message,
      )
    }

    if (typeof expected === 'object' && 'asymmetricMatch' in expected && typeof (expected as any).asymmetricMatch === 'function') {
      const matcher = expected as any as AsymmetricMatcher<any>
      return this.assert(
        thrown && matcher.asymmetricMatch(thrown),
        'expected error to match asymmetric matcher',
        'expected error not to match asymmetric matcher',
        matcher.toString(),
        thrown,
        false,
      )
    }

    throw new Error(`"toThrow" expects string, RegExp, function, Error instance or asymmetric matcher, got "${typeof expected}"`)
  })
  def(['toHaveReturned', 'toReturn'], function () {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const calledAndNotThrew = spy.mock.calls.length > 0 && spy.mock.results.some(({ type }) => type !== 'throw')
    this.assert(
      calledAndNotThrew,
      `expected "${spyName}" to be successfully called at least once`,
      `expected "${spyName}" to not be successfully called`,
      calledAndNotThrew,
      !calledAndNotThrew,
      false,
    )
  })
  def(['toHaveReturnedTimes', 'toReturnTimes'], function (times: number) {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const successfulReturns = spy.mock.results.reduce((success, { type }) => type === 'throw' ? success : ++success, 0)
    this.assert(
      successfulReturns === times,
      `expected "${spyName}" to be successfully called ${times} times`,
      `expected "${spyName}" to not be successfully called ${times} times`,
      `expected number of returns: ${times}`,
      `received number of returns: ${successfulReturns}`,
      false,
    )
  })
  def(['toHaveReturnedWith', 'toReturnWith'], function (value: any) {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const pass = spy.mock.results.some(({ type, value: result }) => type === 'return' && jestEquals(value, result))
    const isNot = utils.flag(this, 'negate') as boolean

    const msg = utils.getMessage(
      this,
      [
        pass,
        `expected "${spyName}" to return with: #{exp} at least once`,
        `expected "${spyName}" to not return with: #{exp}`,
        value,
      ],
    )

    if ((pass && isNot) || (!pass && !isNot))
      throw new AssertionError(formatReturns(spy, msg, value))
  })
  def(['toHaveLastReturnedWith', 'lastReturnedWith'], function (value: any) {
    const spy = getSpy(this)
    const spyName = spy.getMockName()
    const { value: lastResult } = spy.mock.results[spy.mock.results.length - 1]
    const pass = jestEquals(lastResult, value)
    this.assert(
      pass,
      `expected last "${spyName}" call to return #{exp}`,
      `expected last "${spyName}" call to not return #{exp}`,
      value,
      lastResult,
    )
  })
  def(['toHaveNthReturnedWith', 'nthReturnedWith'], function (nthCall: number, value: any) {
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
  def('toSatisfy', function (matcher: Function, message?: string) {
    return this.be.satisfy(matcher, message)
  })

  utils.addProperty(chai.Assertion.prototype, 'resolves', function __VITEST_RESOLVES__(this: any) {
    const error = new Error('resolves')
    utils.flag(this, 'promise', 'resolves')
    utils.flag(this, 'error', error)
    const test: Test = utils.flag(this, 'vitest-test')
    const obj = utils.flag(this, 'object')

    if (typeof obj?.then !== 'function')
      throw new TypeError(`You must provide a Promise to expect() when using .resolves, not '${typeof obj}'.`)

    const proxy: any = new Proxy(this, {
      get: (target, key, receiver) => {
        const result = Reflect.get(target, key, receiver)

        if (typeof result !== 'function')
          return result instanceof chai.Assertion ? proxy : result

        return async (...args: any[]) => {
          const promise = obj.then(
            (value: any) => {
              utils.flag(this, 'object', value)
              return result.call(this, ...args)
            },
            (err: any) => {
              const _error = new AssertionError(
                `promise rejected "${utils.inspect(err)}" instead of resolving`,
                { showDiff: false },
              ) as Error
              _error.cause = err
              _error.stack = (error.stack as string).replace(error.message, _error.message)
              throw _error
            },
          )

          return recordAsyncExpect(test, promise)
        }
      },
    })

    return proxy
  })

  utils.addProperty(chai.Assertion.prototype, 'rejects', function __VITEST_REJECTS__(this: any) {
    const error = new Error('rejects')
    utils.flag(this, 'promise', 'rejects')
    utils.flag(this, 'error', error)
    const test: Test = utils.flag(this, 'vitest-test')
    const obj = utils.flag(this, 'object')
    const wrapper = typeof obj === 'function' ? obj() : obj // for jest compat

    if (typeof wrapper?.then !== 'function')
      throw new TypeError(`You must provide a Promise to expect() when using .rejects, not '${typeof wrapper}'.`)

    const proxy: any = new Proxy(this, {
      get: (target, key, receiver) => {
        const result = Reflect.get(target, key, receiver)

        if (typeof result !== 'function')
          return result instanceof chai.Assertion ? proxy : result

        return async (...args: any[]) => {
          const promise = wrapper.then(
            (value: any) => {
              const _error = new AssertionError(
                `promise resolved "${utils.inspect(value)}" instead of rejecting`,
                { showDiff: true, expected: new Error('rejected promise'), actual: value },
              ) as any
              _error.stack = (error.stack as string).replace(error.message, _error.message)
              throw _error
            },
            (err: any) => {
              utils.flag(this, 'object', err)
              return result.call(this, ...args)
            },
          )

          return recordAsyncExpect(test, promise)
        }
      },
    })

    return proxy
  })
}
