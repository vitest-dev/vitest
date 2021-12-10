import { ChaiPlugin } from './types'

// Jest Expect Compact
// TODO: add more https://jestjs.io/docs/expect
export function JestChaiExpect(): ChaiPlugin {
  return (chai, utils) => {
    function def(name: keyof Chai.Assertion, fn: ((this: Chai.AssertionStatic & Chai.Assertion, ...args: any[]) => any)) {
      utils.addMethod(chai.Assertion.prototype, name, fn)
    }

    def('toEqual', function(expected) {
      return this.eql(expected)
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

    // mock
    def('toHaveBeenCalledTimes', function(number: number) {
      return this.callCount(number)
    })
    def('toHaveBeenCalledOnce', function() {
      return this.callCount(1)
    })
    def('toHaveBeenCalled', function() {
      return this.called
    })
    def('toHaveBeenCalledWith', function(...args) {
      return this.calledWith(...args)
    })
  }
}
