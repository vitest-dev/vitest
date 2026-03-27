import { expect, test } from 'vitest'
import { toMatchInlineSnapshot, toMatchSnapshot } from "vitest/runtime"

// custom snapshot matcher to wraper input code string
interface CustomMatchers<R = unknown> {
  toMatchCustomSnapshot: (properties?: object) => R
  toMatchCustomInlineSnapshot: (snapshot?: string) => R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

function formatCustom(input: string) {
  return {
    reversed: input.split('').reverse().join(''),
    length: input.length,
  }
}

// TODO:
// can we support inlien snapshot with arbitrary options and argument position?
// ideally users should be able to define custom matcher such as:
//   expect(thing).toMatchCustomInlineSnapthot(myCustomOption1, myCustomOption2, `...snaphsot goes here...`)
// does jest supports this pattern?

expect.extend({
  toMatchCustomSnapshot(actual: string, properties?: object) {
    const actualCustom = formatCustom(actual)
    const result = toMatchSnapshot.call(this, actualCustom, properties)
    // result can be further enhanced
    return { ...result, message: () => `[custom error] ${result.message()}` }
  },
  toMatchCustomInlineSnapshot(
    actual: string,
    inlineSnapshot?: string,
  ) {
    const actualCustom = formatCustom(actual)
    const result = toMatchInlineSnapshot.call(this, actualCustom, inlineSnapshot)
    return { ...result, message: () => `[custom error] ${result.message()}` }
  },
})

test('file', () => {
  expect(`hahaha`).toMatchCustomSnapshot()
})

test('properties 1', () => {
  expect(`popopo`).toMatchCustomSnapshot({ length: 6 })
})

test('properties 2', () => {
  expect(`pepepe`).toMatchCustomSnapshot({ length: expect.toSatisfy(function lessThan10(n) { return n < 10 }) })
})

// -- TEST INLINE START --
test('inline', () => {
  expect(`hehehe`).toMatchCustomInlineSnapshot(`
    Object {
      "length": 6,
      "reversed": "eheheh",
    }
  `)
})
// -- TEST INLINE END --
