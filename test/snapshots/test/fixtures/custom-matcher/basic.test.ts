import { expect, test } from 'vitest'
import { toMatchInlineSnapshot, toMatchSnapshot } from "vitest/runtime"

// custom snapshot matcher to wraper input code string
interface CustomMatchers<R = unknown> {
  toMatchCustomSnapshot: () => R
  toMatchCustomInlineSnapshot: (snapshot?: string) => R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

function formatCustom(received: string) {
  return {
    reversed: received.split('').reverse().join(''),
    length: received.length,
  }
}

// TODO:
// can we support inlien snapshot with arbitrary options and argument position?
// ideally users should be able to define custom matcher such as:
//   expect(thing).toMatchCustomInlineSnapthot(myCustomOption1, myCustomOption2, `...snaphsot goes here...`)
// does jest supports this pattern?

expect.extend({
  toMatchCustomSnapshot(received: string) {
    const receivedCustom = formatCustom(received)
    return toMatchSnapshot.call(this, receivedCustom)
  },
  toMatchCustomInlineSnapshot(
    received: string,
    inlineSnapshot?: string,
  ) {
    const receivedCustom = formatCustom(received)
    return toMatchInlineSnapshot.call(this, receivedCustom, inlineSnapshot)
  },
})

test('custom file snapshot matcher', () => {
  expect(`hahaha`).toMatchCustomSnapshot()
})

// -- TEST INLINE START --
test('custom inline snapshot matcher', () => {
  expect(`hehehe`).toMatchCustomInlineSnapshot(`
    Object {
      "length": 6,
      "reversed": "eheheh",
    }
  `)
})
// -- TEST INLINE END --
