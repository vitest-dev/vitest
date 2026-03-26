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

// TODO: make snapshot helper non-throwing and return { pass, ... }
expect.extend({
  toMatchCustomSnapshot(received: string) {
    const receivedCustom = formatCustom(received)
    toMatchSnapshot.call(this, receivedCustom)
    return { pass: true, message: () => '' }
  },
  toMatchCustomInlineSnapshot(
    received: string,
    inlineSnapshot?: string,
  ) {
    const receivedCustom = formatCustom(received)
    toMatchInlineSnapshot.call(this, receivedCustom, inlineSnapshot)
    return { pass: true, message: () => '' }
  },
})

test('custom file snapshot matcher', () => {
  expect(`hahaha`).toMatchCustomSnapshot()
})

test('custom inline snapshot matcher', () => {
  expect(`hehehe`).toMatchCustomInlineSnapshot(`
    Object {
      "length": 6,
      "reversed": "eheheh",
    }
  `)
})
