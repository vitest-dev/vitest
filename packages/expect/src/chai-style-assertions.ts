import type { Assertion, ChaiPlugin } from './types'

/**
 * Chai-style assertions for spy/mock testing.
 *
 * This plugin provides Chai-style assertion names (e.g., `called`, `calledWith`)
 * that delegate to existing Jest-style implementations (e.g., `toHaveBeenCalled`, `toHaveBeenCalledWith`).
 *
 * This allows users migrating from Mocha+Chai+Sinon to use familiar assertion syntax
 * while benefiting from Vitest's existing matcher implementations.
 *
 * @example
 * // Chai-style assertions
 * expect(spy).to.have.been.called
 * expect(spy).to.have.been.calledWith('arg1', 'arg2')
 * expect(spy).to.have.been.calledOnce
 *
 * // These delegate to Jest-style implementations:
 * // toHaveBeenCalled, toHaveBeenCalledWith, toHaveBeenCalledOnce
 */
export const ChaiStyleAssertions: ChaiPlugin = (chai, utils) => {
  function def(
    name: keyof Assertion | (keyof Assertion)[],
    delegateTo: keyof Assertion,
  ) {
    const addMethod = (n: keyof Assertion) => {
      utils.addMethod(
        chai.Assertion.prototype,
        n,
        function (this: Chai.AssertionStatic & Assertion, ...args: any[]) {
          // Delegate to the existing Jest-style implementation
          const jestMethod = (chai.Assertion.prototype as any)[delegateTo]
          if (!jestMethod) {
            throw new Error(
              `Cannot delegate to ${String(delegateTo)}: method not found. Ensure JestChaiExpect plugin is loaded first.`,
            )
          }
          return jestMethod.call(this, ...args)
        },
      )
    }

    if (Array.isArray(name)) {
      name.forEach(n => addMethod(n))
    }
    else {
      addMethod(name)
    }
  }

  // Chai-style assertion: called
  // Delegates to: toHaveBeenCalled
  def('called', 'toHaveBeenCalled')

  // Chai-style assertion: callCount(n)
  // Delegates to: toHaveBeenCalledTimes
  def('callCount', 'toHaveBeenCalledTimes')

  // Chai-style assertion: calledWith(...args)
  // Delegates to: toHaveBeenCalledWith
  def('calledWith', 'toHaveBeenCalledWith')

  // Chai-style assertion: calledOnce
  // Delegates to: toHaveBeenCalledOnce
  def('calledOnce', 'toHaveBeenCalledOnce')

  // Chai-style assertion: calledOnceWith(...args)
  // Delegates to: toHaveBeenCalledExactlyOnceWith
  def('calledOnceWith', 'toHaveBeenCalledExactlyOnceWith')

  // Chai-style assertion: lastCalledWith(...args)
  // Delegates to: toHaveBeenLastCalledWith
  def('lastCalledWith', 'toHaveBeenLastCalledWith')

  // Chai-style assertion: nthCalledWith(n, ...args)
  // Delegates to: toHaveBeenNthCalledWith
  def('nthCalledWith', 'toHaveBeenNthCalledWith')

  // Chai-style assertion: returned
  // Delegates to: toHaveReturned
  def('returned', 'toHaveReturned')

  // Chai-style assertion: returnedWith(value)
  // Delegates to: toHaveReturnedWith
  def('returnedWith', 'toHaveReturnedWith')

  // Additional Chai-style assertions for completeness
  // These follow sinon-chai conventions

  // Chai-style assertion: calledBefore(spy)
  // Delegates to: toHaveBeenCalledBefore
  def('calledBefore', 'toHaveBeenCalledBefore')

  // Chai-style assertion: calledAfter(spy)
  // Delegates to: toHaveBeenCalledAfter
  def('calledAfter', 'toHaveBeenCalledAfter')
}
