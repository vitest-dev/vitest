import { defineAssertion } from '../utils'
import { iterableEquality, equals as jestEquals, subsetEquality } from '../jest-utils'

export default defineAssertion('toMatchObject', function (expected: unknown) {
  const actual = this._obj as unknown
  this.assert(
    jestEquals(actual, expected, [iterableEquality, subsetEquality]),
    'expected #{this} to match object #{exp}',
    'expected #{this} to not match object #{exp}',
    expected,
    actual,
  )
})
