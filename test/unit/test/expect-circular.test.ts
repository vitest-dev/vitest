import { describe, expect, test } from 'vitest'

describe('circular equality', () => {
  test('object, set, map', () => {
    // https://github.com/vitest-dev/vitest/issues/5533
    function gen() {
      const obj = {
        a: new Set<any>(),
        b: new Map<any, any>(),
      }
      obj.a.add(obj)
      obj.b.set('k', obj)
      return obj
    }
    expect(gen()).toEqual(gen())
    expect(gen()).toMatchObject(gen())
  })

  test('object, set', () => {
    function gen() {
      const obj = {
        a: new Set<any>(),
        b: new Set<any>(),
      }
      obj.a.add(obj)
      obj.b.add(obj)
      return obj
    }
    expect(gen()).toEqual(gen())
    expect(gen()).toMatchObject(gen())
  })

  test('array, set', () => {
    function gen() {
      const obj = [new Set<any>(), new Set<any>()]
      obj[0].add(obj)
      obj[1].add(obj)
      return obj
    }
    expect(gen()).toEqual(gen())
    expect(gen()).toMatchObject(gen())
  })

  test('object, array', () => {
    // https://github.com/jestjs/jest/issues/14734
    function gen() {
      const a: any = {
        v: 1,
      }
      const c1: any = {
        ref: [],
      }
      c1.ref.push(c1)
      a.ref = c1
      return a
    }
    expect(gen()).toEqual(gen())
    expect(gen()).toMatchObject(gen())
  })
})
