import { ChaiPlugin } from './types'

// Jest Expect Compact
// TODO: add more https://jestjs.io/docs/expect
export function JestChaiExpect(): ChaiPlugin {
  return (chai, utils) => {
    const proto = chai.Assertion.prototype
    utils.addMethod(proto, 'toEqual', function(this: Chai.Assertion, expected: any) {
      return this.eql(expected)
    })
    utils.addMethod(proto, 'toStrictEqual', function(this: Chai.Assertion, expected: any) {
      return this.equal(expected)
    })
    utils.addMethod(proto, 'toBe', function(this: Chai.Assertion, expected: any) {
      return this.equal(expected)
    })
    utils.addMethod(proto, 'toMatchObject', function(this: Chai.Assertion, expected: any) {
      return this.containSubset(expected)
    })
    utils.addMethod(proto, 'toMatch', function(this: Chai.Assertion, expected: string | RegExp) {
      if (typeof expected === 'string')
        return this.include(expected)
      else
        return this.match(expected)
    })
    utils.addMethod(proto, 'toContain', function(this: Chai.Assertion, item: any) {
      return this.contain(item)
    })

    utils.addMethod(proto, 'toContainEqual', function(this: Chai.AssertionStatic, expected: any) {
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
      },
    )
    utils.addMethod(proto, 'toBeTruthy', function(this: Chai.AssertionStatic) {
      const obj = utils.flag(this, 'object')
      this.assert(
        Boolean(obj),
        'expected #{this} to be truthy',
        'expected #{this} to not be truthy',
        obj,
      )
    })
    utils.addMethod(proto, 'toBeFalsy', function(this: Chai.AssertionStatic) {
      const obj = utils.flag(this, 'object')
      this.assert(
        !obj,
        'expected #{this} to be falsy',
        'expected #{this} to not be falsy',
        obj,
      )
    })
    utils.addMethod(proto, 'toBeNaN', function(this: Chai.Assertion) {
      return this.be.NaN
    })
    utils.addMethod(proto, 'toBeUndefined', function(this: Chai.Assertion) {
      return this.be.undefined
    })
    utils.addMethod(proto, 'toBeNull', function(this: Chai.Assertion) {
      return this.be.null
    })
    utils.addMethod(proto, 'toBeDefined', function(this: Chai.Assertion) {
      return this.not.be.undefined
    })
    utils.addMethod(proto, 'toBeInstanceOf', function(this: Chai.Assertion, obj: any) {
      return this.instanceOf(obj)
    })

    // mock
    utils.addMethod(proto, 'toHaveBeenCalledTimes', function(this: Chai.Assertion, number: number) {
      return this.callCount(number)
    })
    utils.addMethod(proto, 'toHaveBeenCalledOnce', function(this: Chai.Assertion) {
      return this.callCount(1)
    })
    utils.addMethod(proto, 'toHaveBeenCalled', function(this: Chai.Assertion) {
      return this.called
    })
    utils.addMethod(proto, 'toHaveBeenCalledWith', function(this: Chai.Assertion, ...args: any[]) {
      return this.calledWith(...args)
    })
  }
}
