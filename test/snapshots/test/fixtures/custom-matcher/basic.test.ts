import { expect, test } from 'vitest'

// custom snapshot matcher to wraper input code string
interface CustomMatchers<R = unknown> {
  toMatchCustomSnapshot: () => R
  toMatchCustomInlineSnapshot: (snapshot?: string) => R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

function toCustomSnapshot(received: string) {
  return {
    reversed: received.split('').reverse().join(''),
    length: received.length,
  }
}

expect.extend({
  toMatchCustomSnapshot(received: string) {
    const receviedCustom = toCustomSnapshot(received)
    const result = this.snapshotState.match({
      // TODO:
      // it sort of works, but these `testId/testName` aren't exactly what we expect.
      // @ts-expect-error todo
      testId: this.task.id,
      // @ts-expect-error todo
      testName: this.currentTestName,
      received: receviedCustom,
    })

    return {
      pass: result.pass,
      message: () => `Snapshot \`${result.key || 'unknown'}\` mismatched`,
      actual: result.actual?.trim(),
      expected: result.expected?.trim(),
    }
  },
  // toMatchCustomInlineSnapshot: function __INLINE_SNAPSHOT_OFFSET_3__(
  //   received: string,
  //   inlineSnapshot?: string,
  // ) {
  //   const result = this.snapshotState.match({
  //     testId: this.task.id,
  //     testName: this.currentTestName,
  //     received: formatCodeframe(received),
  //     isInline: true,
  //     inlineSnapshot,
  //     error: new Error('snapshot'),
  //   })

  //   return {
  //     pass: result.pass,
  //     message: () => `Snapshot \`${result.key || 'unknown'}\` mismatched`,
  //     actual: result.actual?.trim(),
  //     expected: result.expected?.trim(),
  //   }
  // },
})

test('custom file snapshot matcher', () => {
  expect(`hello`).toMatchCustomSnapshot()
})

// test('custom inline snapshot matcher', () => {
//   expect(`
// const answer = 42
// throw new Error(String(answer))
//   `).toMatchInlineCodeframeSnapshot(`
//     "1 | const answer = 42
//     2 | throw new Error(String(answer))"
//   `)
// })
