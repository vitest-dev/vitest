import { defineAssertion } from '../utils'
import { arrayBufferEquality, iterableEquality, equals as jestEquals, sparseArrayEquality, typeEquality } from '../jest-utils'
import { getCustomEqualityTesters } from '../jest-matcher-utils'

export default defineAssertion('toStrictEqual', function (expected: unknown) {
  const customTesters = getCustomEqualityTesters()
  const obj = this._obj
  const equal = jestEquals(
    obj,
    expected,
    [
      ...customTesters,
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
