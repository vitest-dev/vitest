import { expect, expectTypeOf, test } from 'vitest'

interface CustomMatchers<R = unknown, T = unknown> {
  toMatchSchema: (schema: { a: string }) => R
  toEqualMultiple: (a: string, b: number) => R
  toEqualTyped: (expected: T) => R
}

declare module 'vitest' {
  interface Matchers<R = any, T = any> extends CustomMatchers<R, T> {}
}

test('infers matcher declaration type from a custom matcher type', async () => {
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
    toEqualTyped(received, expected) {
      expectTypeOf(received).toBeAny()
      expectTypeOf(expected).toBeAny()

      return { pass: true, message: () => '' }
    },
  })

  expectTypeOf(expect({ a: 1, b: '2' }).toMatchSchema({ a: '1' })).toEqualTypeOf<void>()
  await (expect(Promise.resolve({ a: '1' })).resolves.toMatchSchema({ a: '1' }) satisfies Promise<void>)
  expect('a').toEqualMultiple('a', 1)
  expect('a').toEqualTyped('b')
  // @ts-expect-error Expected value must match the received type.
  expect('a').toEqualTyped(1)
  await (expect(Promise.resolve('a')).resolves.not.toEqualTyped('b') satisfies Promise<void>)
  // @ts-expect-error Expected value must match the resolved type.
  await expect(Promise.resolve('a')).resolves.toEqualTyped(1)
  await (expect(Promise.reject(new Error('error'))).rejects.toEqualTyped(new Error('error')) satisfies Promise<void>)
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
