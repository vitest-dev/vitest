import { describe, expect, it } from 'vitest'
import { replaceAsymmetricMatcher } from '../../../packages/vitest/src/runtime/error'

describe('replace asymmetric matcher', () => {
  const expectReplaceAsymmetricMatcher = (actual: any, expected: any) => {
    const replaced = replaceAsymmetricMatcher(actual, expected)
    expect(replaced.replacedActual).toEqual(replaced.replacedExpected)
  }
  it('should works', () => {
    expectReplaceAsymmetricMatcher(null, null)
    expectReplaceAsymmetricMatcher(undefined, undefined)
    expectReplaceAsymmetricMatcher(() => {}, expect.any(Function))
    expectReplaceAsymmetricMatcher(false, expect.any(Boolean))
    expectReplaceAsymmetricMatcher(false, expect.anything())
    expectReplaceAsymmetricMatcher(Symbol, expect.anything())
    expectReplaceAsymmetricMatcher({
      str: 'string',
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
      str: 'world',
      arr: [1, 2],
    }, {
      str: expect.any(String),
      arr: [1, expect.anything()],
    })
    expectReplaceAsymmetricMatcher({
      str: 'world',
      bool: false,
    }, {
      str: expect.any(String),
      bool: expect.anything(),
    })
  })
})
