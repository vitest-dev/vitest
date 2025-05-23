import { expect, expectTypeOf, test } from 'vitest'

interface CustomMatchers<R = unknown> {
  toMatchSchema: (schema: { a: string }) => R
  toEqualMultiple: (a: string, b: number) => R
}

declare module 'vitest' {
  interface Matchers<T = any> extends CustomMatchers<T> {}
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

test('automatically extends asymmetric matchers', () => {
  expect({}).toEqual({
    nestedSchema: expect.toMatchSchema({
      a: '1',
      // @ts-expect-error Unknown property.
      b: 2,
    }),
  })
})

test('treats matcher declarations as optional', () => {
  expect.extend(
    /**
     * @note Although annotated, you don't have to declare matchers.
     * You can call `expect.extend()` multiple times or get the matcher
     * declarations from a third-party library.
     */
    {},
  )
})
