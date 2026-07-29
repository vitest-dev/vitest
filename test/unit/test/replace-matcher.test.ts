import { replaceAsymmetricMatcher } from '@vitest/utils/diff'
import { describe, expect, it } from 'vitest'

describe('replace asymmetric matcher', () => {
  const expectReplaceAsymmetricMatcher = (actual: any, expected: any) => {
    const replaced = replaceAsymmetricMatcher(actual, expected)
    expect(replaced.replacedActual).toEqual(replaced.replacedExpected)
  }
  it('should work when various types are passed in', () => {
    expectReplaceAsymmetricMatcher(null, null)
    expectReplaceAsymmetricMatcher(undefined, undefined)
    expectReplaceAsymmetricMatcher({}, {})
    expectReplaceAsymmetricMatcher([1, 2], [1, 2])
    expectReplaceAsymmetricMatcher({}, expect.any(Object))
    expectReplaceAsymmetricMatcher(() => {}, expect.any(Function))
    expectReplaceAsymmetricMatcher(Promise, expect.any(Function))
    expectReplaceAsymmetricMatcher(false, expect.any(Boolean))
    expectReplaceAsymmetricMatcher([1, 2], [1, expect.any(Number)])
    expectReplaceAsymmetricMatcher(false, expect.anything())
    expectReplaceAsymmetricMatcher({}, expect.anything())
    expectReplaceAsymmetricMatcher(Symbol, expect.anything())
    expectReplaceAsymmetricMatcher(Promise, expect.anything())
    expectReplaceAsymmetricMatcher(new Map([['a', 1]]), expect.anything())
    expectReplaceAsymmetricMatcher(new Set([1, 2]), expect.anything())
    expectReplaceAsymmetricMatcher(new ArrayBuffer(8), expect.anything())
    expectReplaceAsymmetricMatcher([1, 2], [1, expect.anything()])
    expectReplaceAsymmetricMatcher({
      str: 'a',
      arr: [1, 2],
    }, {
      str: expect.any(String),
      arr: expect.anything(),
    })
    expectReplaceAsymmetricMatcher({
      str: expect.any(String),
      arr: expect.anything(),
    }, {
      str: expect.any(String),
      arr: expect.anything(),
    })
    expectReplaceAsymmetricMatcher({
      str: 'a',
      arr: [1, 2],
    }, {
      str: expect.any(String),
      arr: [1, expect.anything()],
    })
    const circleObj: any = { name: 'circle', ref: null }
    circleObj.ref = circleObj
    expectReplaceAsymmetricMatcher(circleObj, circleObj)
  })
})
