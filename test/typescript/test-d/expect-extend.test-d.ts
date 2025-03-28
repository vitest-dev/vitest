import { expect, expectTypeOf, test } from 'vitest'

interface CustomMatchers<R = unknown> {
  toMatchSchema: (schema: { a: string }) => R
  toEqualMultiple: (a: string, b: number) => R
}

declare module 'vitest' {
  interface Matchers extends CustomMatchers {}
}

test('infers matcher declaration type from a custom matcher type', () => {
  expect.extend({
    toMatchSchema(received, expected) {
      expectTypeOf(received).toBeAny()
      expectTypeOf(expected).toEqualTypeOf<{ a: string }>()

      return { pass: true, message: () => '' }
    },
    toEqualMultiple(received, a, b) {
      expectTypeOf(received).toBeAny()
      expectTypeOf(a).toBeString()
      expectTypeOf(b).toBeNumber()

      return { pass: true, message: () => '' }
    },
  })

  expect({ a: 1, b: '2' }).toMatchSchema({ a: '1' })
  expect('a').toEqualMultiple('a', 1)
})

test('errors on missing matcher declarations', () => {
  expect.extend(
    // @ts-expect-error Missing declaration for all custom matchers.
    {},
  )

  expect.extend(
    // @ts-expect-error Missing declaration for some custom matchers.
    {
      toMatchSchema(_received, _expected) {
        return { pass: true, message: () => '' }
      },
    },
  )
})
