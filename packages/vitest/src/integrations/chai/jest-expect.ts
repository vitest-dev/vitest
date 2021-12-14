import type { SinonSpy } from 'sinon'
import type { ChaiPlugin } from './types'

import { equals } from './jest-utils'

// Jest Expect Compact
// TODO: add more https://jestjs.io/docs/expect
export function JestChaiExpect(): ChaiPlugin {
  return (chai, utils) => {
    function def(name: keyof Chai.Assertion | (keyof Chai.Assertion)[], fn: ((this: Chai.AssertionStatic & Chai.Assertion, ...args: any[]) => any)) {
      const addMethod = (n: keyof Chai.Assertion) => {
        utils.addMethod(chai.Assertion.prototype, n, fn)
      }

      if (Array.isArray(name))
        name.forEach(n => addMethod(n))

      else
        addMethod(name)
    }

    def('toEqual', function(expected) {
      const actual = utils.flag(this, 'object')
      const result = equals(actual, expected)
      this.assert(
        result,
        'not match with #{this}',
        'should not match with #{this}',
        true,
      )
    })
    def('toStrictEqual', function(expected) {
      return this.equal(expected)
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
    def('toContain', function(item) { return this.contain(item) })
    def('toContainEqual', function(expected) {
      const obj = utils.flag(this, 'object')
      const index = Array.from(obj).findIndex((item) => {
        try {
          chai.assert.deepEqual(item, expected)
        }
        catch {
          return false
        }
        return true
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
    def('toBeCloseTo', function(number: number, numDigits = 2) {
      utils.expectTypes(this, ['number'])
      return this.closeTo(number, numDigits)
    })

    // mock
    function isSpy(putativeSpy: any) {
      return typeof putativeSpy === 'function'
             && typeof putativeSpy.getCall === 'function'
             && typeof putativeSpy.calledWithExactly === 'function'
    }
    function isCall(putativeCall: any) {
      return putativeCall && isSpy(putativeCall.proxy)
    }
    const assertIsMock = (assertion: any) => {
      if (!isSpy(assertion._obj) && !isCall(assertion._obj))
        throw new TypeError(`${utils.inspect(assertion._obj)} is not a spy or a call to a spy!`)
    }
    def(['toHaveBeenCalledTimes', 'toBeCalledTimes'], function(number: number) {
      assertIsMock(this)
      return this.callCount(number)
    })
    def('toHaveBeenCalledOnce', function() {
      assertIsMock(this)
      return this.callCount(1)
    })
    def(['toHaveBeenCalled', 'toBeCalled'], function() {
      assertIsMock(this)
      return this.called
    })
    def(['toHaveBeenCalledWith', 'toBeCalledWith'], function(...args) {
      assertIsMock(this)
      return this.calledWith(...args)
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
      assertIsMock(this)
      const spy = utils.flag(this, 'object') as SinonSpy
      const nthCall = spy.getCall(times - 1)

      this.assert(
        nthCall.calledWith(...args),
        `expected ${ordinalOf(times)} spy call to have been called with #{exp}`,
        `expected ${ordinalOf(times)} spy call not to have been called with #{exp}`,
        args,
        nthCall.args,
      )
    })
    def(['toHaveBeenLastCalledWith', 'lastCalledWith'], function(...args: any[]) {
      assertIsMock(this)
      const spy = utils.flag(this, 'object') as SinonSpy
      const lastCall = spy.getCall(spy.returnValues.length - 1)

      this.assert(
        lastCall.calledWith(...args),
        'expected last spy call to have been called with #{exp}',
        'expected last spy call not to have been called with #{exp}',
        args,
        lastCall.args,
      )
    })
    def(['toThrow', 'toThrowError'], function(expected: string | RegExp) {
      const negate = utils.flag(this, 'negate')

      if (negate)
        this.not.to.throw(expected)
      else
        this.to.throw(expected)
    })
    def(['toHaveReturned', 'toReturn'], function() {
      assertIsMock(this)
      const spy = utils.flag(this, 'object') as SinonSpy
      const calledAndNotThrew = spy.called && !spy.alwaysThrew()
      this.assert(
        calledAndNotThrew,
        'expected spy to be successfully called at least once',
        'expected spy not to be successfully called',
        calledAndNotThrew,
        !calledAndNotThrew,
      )
    })
    def(['toHaveReturnedTimes', 'toReturnTimes'], function(times: number) {
      assertIsMock(this)
      const spy = utils.flag(this, 'object') as SinonSpy
      const successfullReturns = spy.getCalls().reduce((success, call) => call.threw() ? success : ++success, 0)
      this.assert(
        successfullReturns === times,
        `expected spy to be successfully called ${times} times`,
        `expected spy not to be successfully called ${times} times`,
        `expected number of returns: ${times}`,
        `recieved number of returns: ${successfullReturns}`,
      )
    })
    def(['toHaveReturnedWith', 'toReturnWith'], function(value: any) {
      assertIsMock(this)
      return this.returned(value)
    })
    def(['toHaveLastReturnedWith', 'lastReturnedWith'], function(value: any) {
      assertIsMock(this)
      const spy = utils.flag(this, 'object') as SinonSpy
      const lastReturn = spy.lastCall.returned(value)
      this.assert(
        lastReturn,
        'expected last spy call to return #{exp}',
        'expected last spy call not to return #{exp}',
        value,
        spy.lastCall.returnValue,
      )
    })
    def(['toHaveNthReturnedWith', 'nthReturnedWith'], function(nthCall: number, value: any) {
      assertIsMock(this)
      const spy = utils.flag(this, 'object') as SinonSpy
      const isNot = utils.flag(this, 'negate') as boolean
      const call = spy.getCall(nthCall - 1)
      const ordinalCall = `${ordinalOf(nthCall)} call`

      if (!isNot && call.threw())
        chai.assert.fail(`expected ${ordinalCall} to return #{exp}, but instead it threw an error`)

      const nthCallReturn = call.returned(value)

      this.assert(
        nthCallReturn,
        `expected ${ordinalCall} spy call to return #{exp}`,
        `expected ${ordinalCall} spy call not to return #{exp}`,
        value,
        call.returnValue,
      )
    })
  }
}
