import { describe, expect, test } from 'vitest'
import { assertTypes, deepClone, deepMerge, resetModules, toArray } from '../../../packages/vitest/src/utils'
import { deepMergeSnapshot } from '../../../packages/vitest/src/integrations/snapshot/port/utils'
import type { ModuleCacheMap } from '../../../packages/vite-node/src/types'

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
    class TestA {
      baz = 'baz'

      get foo() {
        return 'foo'
      }
    }
    class TestB {
      bar = 'bar'
    }

    const testA = new TestA()
    const testB = new TestB()

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

    expect(merged.test instanceof TestB).toBe(true)
    expect(merged.test.baz).toBeUndefined()
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

describe('deepClone', () => {
  test('various types should be cloned correctly', () => {
    expect(deepClone(1)).toBe(1)
    expect(deepClone(true)).toBe(true)
    expect(deepClone(undefined)).toBe(undefined)
    expect(deepClone(null)).toBe(null)
    expect(deepClone({ a: 1 })).toEqual({ a: 1 })
    expect(deepClone([1, 2])).toEqual([1, 2])
    const symbolA = Symbol('a')
    expect(deepClone(symbolA)).toBe(symbolA)
    const objB: any = {}
    Object.defineProperty(objB, 'value', {
      configurable: false,
      enumerable: false,
      value: 1,
      writable: false,
    })
    expect(deepClone(objB).value).toEqual(objB.value)
    const objC = Object.create(objB)
    expect(deepClone(objC).value).toEqual(objC.value)
    const objD: any = { name: 'd', ref: null }
    objD.ref = objD
    expect(deepClone(objD)).toEqual(objD)
  })
})

describe('resetModules doesn\'t resets only user modules', () => {
  test('resets user modules', () => {
    const moduleCache = new Map() as ModuleCacheMap
    moduleCache.set('/some-module.ts', {})
    moduleCache.set('/@fs/some-path.ts', {})

    resetModules(moduleCache)

    expect(moduleCache.size).toBe(0)
  })

  test('doesn\'t reset vitest modules', () => {
    const moduleCache = new Map() as ModuleCacheMap
    moduleCache.set('/node_modules/vitest/dist/index.js', {})
    moduleCache.set('/node_modules/vitest-virtual-da9876a/dist/index.js', {})
    moduleCache.set('/node_modules/some-module@vitest/dist/index.js', {})
    moduleCache.set('/packages/vitest/dist/index.js', {})

    resetModules(moduleCache)

    expect(moduleCache.size).toBe(4)
  })

  test('doesn\'t reset mocks', () => {
    const moduleCache = new Map() as ModuleCacheMap
    moduleCache.set('mock:/some-module.ts', {})
    moduleCache.set('mock:/@fs/some-path.ts', {})

    resetModules(moduleCache)

    expect(moduleCache.size).toBe(2)
  })
})
