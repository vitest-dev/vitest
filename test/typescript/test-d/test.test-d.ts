import { google, type sheets_v4 } from 'googleapis'
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
    // eslint-disable-next-line ts/prefer-ts-expect-error
    // @ts-ignore 45 is not a string
    expectTypeOf(45).toEqualTypeOf<string>()
  })

  test('expected error', () => {
    // @ts-expect-error 45 is not a string
    expectTypeOf(45).toEqualTypeOf<string>()
  })

  test('spyOn googleapis compiles', () => {
    vi.spyOn(google, 'sheets').mockReturnValue({
      spreadsheets: {
        values: {
          get: vi.fn().mockResolvedValue({ data: { values: [['', '']] } }),
          update: vi.fn().mockResolvedValue({}),
        } as Partial<sheets_v4.Resource$Spreadsheets$Values> as sheets_v4.Resource$Spreadsheets$Values,
      } as sheets_v4.Resource$Spreadsheets,
    } as sheets_v4.Sheets)
  })
})

expectTypeOf({ wolk: 'true' }).toHaveProperty('wolk')
