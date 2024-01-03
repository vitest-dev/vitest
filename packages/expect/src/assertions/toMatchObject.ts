import { AssertionError, util } from 'chai'
import { defineAssertion } from '../utils'
import { getObjectSubset, iterableEquality, equals as jestEquals, subsetEquality } from '../jest-utils'
import { getCustomEqualityTesters } from '../jest-matcher-utils'

export default defineAssertion('toMatchObject', function (expected: unknown) {
  const customTesters = getCustomEqualityTesters()
  const actual = this._obj
  const pass = jestEquals(actual, expected, [...customTesters, iterableEquality, subsetEquality])
  const isNot = util.flag(this, 'negate') as boolean
  const { subset: actualSubset, stripped } = getObjectSubset(actual, expected)
  if ((pass && isNot) || (!pass && !isNot)) {
    const msg = util.getMessage(
      this,
      [
        pass,
        'expected #{this} to match object #{exp}',
        'expected #{this} to not match object #{exp}',
        expected,
        actualSubset,
        false,
      ],
    )
    const message = stripped === 0 ? msg : `${msg}\n(${stripped} matching ${stripped === 1 ? 'property' : 'properties'} omitted from actual)`
    throw new AssertionError(message, { showDiff: true, expected, actual: actualSubset })
  }
})
