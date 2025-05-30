/* eslint-disable ts/ban-ts-comment */

import { describe, expectTypeOf, test, vi } from 'vitest'

describe('test', () => {
  test('some-test', () => {
    expectTypeOf(Date).toBeConstructibleWith(new Date())
    expectTypeOf(Date).toBeConstructibleWith('01-01-2000')

    type ResponsiveProp<T> = T | T[] | { xs?: T; sm?: T; md?: T }
    const getResponsiveProp = <T>(_props: T): ResponsiveProp<T> => ({})
    interface CSSProperties { margin?: string; padding?: string }
    const cssProperties: CSSProperties = { margin: '1px', padding: '2px' }
    expectTypeOf(getResponsiveProp(cssProperties))
      .exclude<unknown[] | { xs?: unknown }>()
      // .exclude<{ xs?: unknown }>()
      .toEqualTypeOf<CSSProperties>()
  })

  describe('test2', () => {
    test('some-test 2', () => {
      expectTypeOf(Promise.resolve('string')).resolves.toEqualTypeOf<string>()
      expectTypeOf(45).toEqualTypeOf(45)
    })
  })

  test('ignored error', () => {
    // @ts-ignore 45 is not a string
    expectTypeOf(45).toEqualTypeOf<string>()
  })

  test('expected error', () => {
    // @ts-expect-error 45 is not a string
    expectTypeOf(45).toEqualTypeOf<string>()
  })

  test('spyOn googleapis compiles', () => {
    // googleapis-like typing to reproduce https://github.com/vitest-dev/vitest/issues/3141
    let google!: {
      [key: string]: unknown
      sheets: () => { foo: string }
    }
    vi.spyOn(google, 'sheets').mockReturnValue({ foo: 'bar' })
    // @ts-expect-error
    vi.spyOn(google, 'sheets').mockReturnValue({ foo: 1234 })
  })
})

expectTypeOf({ wolk: 'true' }).toHaveProperty('wolk')
