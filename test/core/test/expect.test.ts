import { getCurrentTest } from '@vitest/runner'
import { describe, expect, expectTypeOf, test } from 'vitest'

describe('expect.soft', () => {
  test('types', () => {
    expectTypeOf(expect.soft).toEqualTypeOf(expect)
    expectTypeOf(expect.soft(7)).toEqualTypeOf(expect(7))
    expectTypeOf(expect.soft(5)).toHaveProperty('toBe')
    expectTypeOf(expect.soft(7)).not.toHaveProperty('toCustom')
  })

  test('return value', () => {
    expect(expect.soft('test')).toHaveProperty('toBe')
    expect(expect.soft('test')).toHaveProperty('toEqual')
  })

  test('with extend', () => {
    expect.extend({
      toBeFoo(received) {
        const { isNot } = this
        return {
          // do not alter your "pass" based on isNot. Vitest does it for you
          pass: received === 'foo',
          message: () => `${received} is${isNot ? ' not' : ''} foo`,
        }
      },
    })
    expect(expect.soft('test')).toHaveProperty('toBeFoo')
  })

  test('should have multiple error', () => {
    expect.soft(1).toBe(2)
    expect.soft(2).toBe(3)
    getCurrentTest()!.result!.state = 'run'
    expect(getCurrentTest()?.result?.errors).toHaveLength(2)
  })

  test.fails('should be a failure', () => {
    expect.soft('test1').toBe('test res')
    expect.soft('test2').toBe('test res')
    expect.soft('test3').toBe('test res')
  })
})
