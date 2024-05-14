import { defineAssertion } from '../utils'
import { iterableEquality, equals as jestEquals } from '../jest-utils'
import { getCustomEqualityTesters } from '../jest-matcher-utils'

export default defineAssertion('toEqual', function (expected: unknown) {
  const customTesters = getCustomEqualityTesters()
  const actual = this._obj
  const equal = jestEquals(
    actual,
    expected,
    [...customTesters, iterableEquality],
  )

  return this.assert(
    equal,
    'expected #{this} to deeply equal #{exp}',
    'expected #{this} to not deeply equal #{exp}',
    expected,
    actual,
  )
})
