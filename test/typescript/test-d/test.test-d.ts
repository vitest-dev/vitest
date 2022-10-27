/* eslint-disable @typescript-eslint/ban-ts-comment */
import { describe, expectTypeOf, test } from 'vitest'

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
    // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
    // @ts-ignore
    expectTypeOf(45).toEqualTypeOf<string>()
  })

  test('expected error', () => {
    // @ts-expect-error
    expectTypeOf(45).toEqualTypeOf<string>()
  })
})

expectTypeOf({ wolk: 'true' }).toHaveProperty('wolk')
