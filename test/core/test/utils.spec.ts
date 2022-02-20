import { describe, expect, test } from 'vitest'
import { assertTypes, deepMerge, toArray } from '../../../packages/vitest/src/utils'
import { deepMergeSnapshot } from '../../../packages/vitest/src/integrations/snapshot/port/utils'

describe('assertTypes', () => {
  test('the type of value should be number', () => {
    const value = 5
    const value_string = '5'
    assertTypes(value, 'value', ['number'])
    expect(() => assertTypes(value_string, 'value_string', ['number'])).toThrow()
  })

  test('the type of value should be number or BigInt', () => {
    const value_number = 5
    const value_bigint = BigInt(5)
    const value_string = '5'
    assertTypes(value_number, 'value_number', ['number', 'bigint'])
    assertTypes(value_bigint, 'value_bigint', ['number', 'bigint'])
    expect(() => assertTypes(value_string, 'value_string', ['number', 'bigint'])).toThrow()
  })
})

describe('deepMerge', () => {
  test('non plain objects retain their prototype, arrays are not merging, plain objects are merging', () => {
    class Test {
      baz = 'baz'

      get foo() {
        return 'foo'
      }
    }

    const testA = new Test()
    const testB = new Test()

    const a = {
      test: testA,
      num: 30,
      array: [1, 2],
      obj: {
        foo: 'foo',
      },
    }

    const b = {
      test: testB,
      num: 40,
      array: [3, 4],
      obj: {
        baz: 'baz',
      },
    }

    const merged = deepMerge(a, b)

    expect(merged.test instanceof Test).toBe(true)
    expect(merged.num).toBe(40)
    expect(merged.array).toEqual([3, 4])
    expect(merged.obj).toEqual({
      foo: 'foo',
      baz: 'baz',
    })
  })

  test('deepMergeSnapshot considers asymmetric matcher', () => {
    class Test {
      zoo = 'zoo'
      get bar() {
        return 'name'
      }
    }

    const obj = deepMergeSnapshot({
      regexp: /test/,
      test: new Test(),
      name: 'name',
      foo: 5,
      array: [/test/, 'test'],
    }, {
      name: expect.stringContaining('name'),
      foo: 88,
      array: [/test2/],
      test: { baz: 'baz' },
    })

    expect(obj.regexp instanceof RegExp).toBe(true)
    expect(obj.test instanceof Test).toBe(false)
    expect(obj.array[0] instanceof RegExp).toBe(false)

    expect(obj).toEqual({
      regexp: /test/,
      test: { baz: 'baz', zoo: 'zoo' },
      name: expect.stringContaining('name'),
      foo: 88,
      array: [{}, 'test'],
    })
  })
})

describe('toArray', () => {
  test('number should be converted to array correctly', () => {
    expect(toArray(0)).toEqual([0])
    expect(toArray(1)).toEqual([1])
    expect(toArray(2)).toEqual([2])
  })

  test('return empty array when given null or undefined', () => {
    expect(toArray(null)).toEqual([])
    expect(toArray(undefined)).toEqual([])
  })

  test('return the value as is when given the array', () => {
    expect(toArray([1, 1, 2])).toEqual([1, 1, 2])
  })

  test('object should be stored in the array correctly', () => {
    expect(toArray({ a: 1, b: 1, expected: 2 })).toEqual([{ a: 1, b: 1, expected: 2 }])
  })
})
